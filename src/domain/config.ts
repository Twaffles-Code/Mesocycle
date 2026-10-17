// The config file: a JSON description of a meso you can write by hand,
// import, and export. It describes structure only — never results.
//
// Two ways to write an exercise's sets:
//   short:  { "name": "DB Row", "sets": 3, "reps": "8-12", "rir": "1-2", "weight": 95 }
//   long:   { "name": "DB Row", "sets": [ { "reps": "8-12", "rir": "2" }, { "reps": "8-12", "rir": "1" } ] }

import { z } from 'zod'
import type { DayPlan, ExercisePlan, MesoPlan, SetPlan } from './types'
import { DEFAULT_TRAINING_WEEKS } from './meso'

export const MAX_SETS = 20
export const MAX_DAYS = 7
export const MAX_TRAINING_WEEKS = 12

const repsField = z
  .union([z.string().trim().min(1, 'cannot be empty'), z.int().positive()], { error: 'should be text like "8-12" or a whole number' })
  .transform(String)
const rirField = z.union([z.string().trim(), z.int().min(0)], { error: 'should be text like "1-2" or a whole number' }).transform(String)
const weightField = z.number().nonnegative().nullable()

// strictObject rejects unknown keys, so a typo like "rep" is an error rather than silently ignored.
const setSchema = z.strictObject({
  reps: repsField,
  rir: rirField.optional(),
  weight: weightField.optional(),
})

const exerciseSchema = z
  .strictObject({
    name: z.string().trim().min(1, 'needs a name'),
    sets: z.union(
      [
        z.int().min(1, 'needs at least 1 set').max(MAX_SETS, `can't be more than ${MAX_SETS}`),
        z.array(setSchema).min(1, 'needs at least 1 set').max(MAX_SETS, `can't be more than ${MAX_SETS}`),
      ],
      { error: 'should be a number of sets (like 3) or a list of sets' },
    ),
    reps: repsField.optional(),
    rir: rirField.optional(),
    weight: weightField.optional(),
  })
  .superRefine((ex, ctx) => {
    if (typeof ex.sets === 'number' && ex.reps === undefined) {
      ctx.addIssue({ code: 'custom', path: ['reps'], message: 'is required when "sets" is a number' })
    }
  })

const daySchema = z.strictObject({
  name: z.string().trim().min(1, 'needs a name'),
  exercises: z.array(exerciseSchema).min(1, 'needs at least one exercise'),
})

const configSchema = z.strictObject({
  version: z.literal(1).optional(),
  name: z.string().trim().min(1, 'needs a name'),
  units: z.enum(['lb', 'kg']).optional(),
  trainingWeeks: z.int().min(1).max(MAX_TRAINING_WEEKS).optional(),
  days: z.array(daySchema).min(1, 'needs at least one day').max(MAX_DAYS),
})

export type MesoConfig = z.input<typeof configSchema>
type ParsedExercise = z.output<typeof exerciseSchema>

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

/** Read a config file's text. Returns the plan, or a list of plain-English problems with where they are. */
export function parseConfig(text: string): ParseResult<MesoPlan> {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }
  const result = configSchema.safeParse(json)
  if (!result.success) return { ok: false, errors: formatIssues(result.error.issues) }

  const c = result.data
  return {
    ok: true,
    value: {
      name: c.name,
      units: c.units ?? 'lb',
      trainingWeeks: c.trainingWeeks ?? DEFAULT_TRAINING_WEEKS,
      days: c.days.map((d): DayPlan => ({ name: d.name, exercises: d.exercises.map(exercisePlanFromConfig) })),
    },
  }
}

function exercisePlanFromConfig(ex: ParsedExercise): ExercisePlan {
  const sets: SetPlan[] =
    typeof ex.sets === 'number'
      ? Array.from({ length: ex.sets }, () => ({ targetReps: ex.reps ?? '', targetRir: ex.rir ?? '', targetWeight: ex.weight ?? null }))
      : ex.sets.map((s) => ({ targetReps: s.reps, targetRir: s.rir ?? ex.rir ?? '', targetWeight: s.weight ?? ex.weight ?? null }))
  return { name: ex.name, sets }
}

/** The reverse: a plan as a config object, using the short form wherever every set is the same. */
export function configFromPlan(plan: MesoPlan): MesoConfig {
  return {
    version: 1,
    name: plan.name,
    units: plan.units,
    trainingWeeks: plan.trainingWeeks,
    days: plan.days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((ex) => {
        const first = ex.sets[0]
        const uniform = first && ex.sets.every((s) => s.targetReps === first.targetReps && s.targetRir === first.targetRir && s.targetWeight === first.targetWeight)
        if (uniform) {
          return {
            name: ex.name,
            sets: ex.sets.length,
            reps: first.targetReps,
            ...(first.targetRir ? { rir: first.targetRir } : {}),
            ...(first.targetWeight !== null ? { weight: first.targetWeight } : {}),
          }
        }
        return {
          name: ex.name,
          sets: ex.sets.map((s) => ({
            reps: s.targetReps,
            ...(s.targetRir ? { rir: s.targetRir } : {}),
            ...(s.targetWeight !== null ? { weight: s.targetWeight } : {}),
          })),
        }
      }),
    })),
  }
}

// ── Error messages ───────────────────────────────────────────────────────

type Issue = z.core.$ZodIssue

/** ["days", 0, "exercises", 2, "reps"] → "days[0].exercises[2].reps" */
function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((out, key) => (typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${String(key)}` : String(key)), '')
}

function formatIssues(issues: Issue[], prefix: PropertyKey[] = []): string[] {
  return issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path]
    // A field that accepts two forms (like "sets": 3 or "sets": [...]). If one form
    // got further than a plain wrong-type, report *its* problem — that's the form
    // you were evidently writing. Otherwise use the field's own message.
    if (issue.code === 'invalid_union') {
      const relevant = issue.errors.find((branch) => !branch.every((i) => i.code === 'invalid_type' && i.path.length === 0))
      if (relevant) return formatIssues(relevant, path)
    }
    if (issue.code === 'unrecognized_keys') {
      return [`${formatPath(path) || 'top level'}: unknown field${issue.keys.length > 1 ? 's' : ''} ${issue.keys.map((k) => `"${k}"`).join(', ')}`]
    }
    return [`${formatPath(path) || 'file'}: ${issue.message}`]
  })
}
