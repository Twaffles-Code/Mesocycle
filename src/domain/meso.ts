// Building and reshaping mesos. Every function here is "pure": it takes data,
// returns new data, and never changes what it was given. That makes undo,
// testing, and saving trivial — the old version is still sitting there intact.

import { newId } from './ids'
import type {
  Day,
  DayExercise,
  DayPlan,
  ExercisePlan,
  Meso,
  MesoPlan,
  SetPlan,
  Week,
  WorkoutSet,
} from './types'

export const DEFAULT_TRAINING_WEEKS = 4

// ── Plan → real data ─────────────────────────────────────────────────────

export function setFromPlan(plan: SetPlan): WorkoutSet {
  return {
    id: newId(),
    targetReps: plan.targetReps,
    targetRir: plan.targetRir,
    targetWeight: plan.targetWeight,
    weight: null,
    reps: null,
    rir: null,
    status: 'pending',
  }
}

export function exerciseFromPlan(plan: ExercisePlan): DayExercise {
  return { id: newId(), name: plan.name.trim(), skipped: false, sets: plan.sets.map(setFromPlan) }
}

export function dayFromPlan(plan: DayPlan): Day {
  return {
    id: newId(),
    name: plan.name.trim(),
    notes: '',
    skipped: false,
    exercises: plan.exercises.map(exerciseFromPlan),
  }
}

function weekFromPlans(days: DayPlan[], isDeload: boolean): Week {
  return { id: newId(), isDeload, days: days.map(dayFromPlan) }
}

/** A new meso: N training weeks (4 unless told otherwise) followed by one deload week. */
export function createMeso(plan: MesoPlan, now: Date = new Date()): Meso {
  if (!plan.name.trim()) throw new Error('A meso needs a name.')
  if (plan.days.length === 0) throw new Error('A meso needs at least one day.')
  if (!Number.isInteger(plan.trainingWeeks) || plan.trainingWeeks < 1) {
    throw new Error('A meso needs at least one training week.')
  }
  const weeks: Week[] = []
  for (let i = 0; i < plan.trainingWeeks; i++) weeks.push(weekFromPlans(plan.days, false))
  weeks.push(weekFromPlans(plan.days, true))

  const stamp = now.toISOString()
  return { id: newId(), name: plan.name.trim(), units: plan.units, createdAt: stamp, updatedAt: stamp, weeks }
}

// ── Real data → plan ─────────────────────────────────────────────────────

/** The structure of a day with the results stripped off. Keeps exercise ids so edits can find them again. */
export function planFromDay(day: Day): DayPlan {
  return {
    name: day.name,
    exercises: day.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets.map((s) => ({ targetReps: s.targetReps, targetRir: s.targetRir, targetWeight: s.targetWeight })),
    })),
  }
}

/** The meso's current structure, taken from its last training week. Used to export a config or start the next meso. */
export function planFromMeso(meso: Meso): MesoPlan {
  const lastTraining = lastTrainingWeek(meso)
  return {
    name: meso.name,
    units: meso.units,
    trainingWeeks: trainingWeekCount(meso),
    days: (lastTraining?.days ?? []).map((d) => {
      const plan = planFromDay(d)
      // A plan for a *new* meso shouldn't point at this meso's exercise ids.
      return { ...plan, exercises: plan.exercises.map(({ name, sets }) => ({ name, sets })) }
    }),
  }
}

// ── Weeks ────────────────────────────────────────────────────────────────

export function trainingWeekCount(meso: Meso): number {
  return meso.weeks.filter((w) => !w.isDeload).length
}

function lastTrainingWeek(meso: Meso): Week | undefined {
  return meso.weeks.filter((w) => !w.isDeload).at(-1)
}

export function deloadIndex(meso: Meso): number {
  return meso.weeks.findIndex((w) => w.isDeload)
}

/** "Week 3" for training weeks, "Deload" for the deload. Numbers only count training weeks. */
export function weekLabel(meso: Meso, weekIndex: number): string {
  const week = meso.weeks[weekIndex]
  if (!week) return ''
  if (week.isDeload) return 'Deload'
  const number = meso.weeks.slice(0, weekIndex + 1).filter((w) => !w.isDeload).length
  return `Week ${number}`
}

/** Weeks between this one and the deload: 0 means this *is* the deload, negative means it's behind you. */
export function weeksUntilDeload(meso: Meso, weekIndex: number): number | null {
  const d = deloadIndex(meso)
  return d === -1 ? null : d - weekIndex
}

/**
 * Add one training week. It goes just before the deload (so the deload stays last)
 * and copies the structure of the latest training week — including any exercise
 * swaps you've made — with all results cleared.
 */
export function addWeek(meso: Meso, now: Date = new Date()): Meso {
  const source = lastTrainingWeek(meso)
  if (!source) throw new Error('No training week to copy from.')
  // Going through a plan copies structure only: results, notes and one-off skips stay behind.
  const week = weekFromPlans(source.days.map(planFromDay), false)
  const weeks = [...meso.weeks]
  const d = deloadIndex(meso)
  weeks.splice(d === -1 ? weeks.length : d, 0, week)
  return { ...meso, weeks, updatedAt: now.toISOString() }
}

/** Remove a training week. The deload can't be removed, and at least one training week must remain. */
export function removeWeek(meso: Meso, weekId: string, now: Date = new Date()): Meso {
  const week = meso.weeks.find((w) => w.id === weekId)
  if (!week) throw new Error('Week not found.')
  if (week.isDeload) throw new Error("The deload week can't be removed.")
  if (trainingWeekCount(meso) <= 1) throw new Error('A meso needs at least one training week.')
  return { ...meso, weeks: meso.weeks.filter((w) => w.id !== weekId), updatedAt: now.toISOString() }
}

/** A name for the meso after this one: bumps the last number ("Meso 5 - Mass 2" → "Meso 5 - Mass 3"), or adds " (next)". */
export function suggestNextName(name: string): string {
  const match = /(\d+)(?!.*\d)/.exec(name)
  if (!match) return `${name} (next)`
  return name.slice(0, match.index) + String(Number(match[1]) + 1) + name.slice(match.index + match[1]!.length)
}

export function renameMeso(meso: Meso, name: string, now: Date = new Date()): Meso {
  if (!name.trim()) throw new Error('A meso needs a name.')
  return { ...meso, name: name.trim(), updatedAt: now.toISOString() }
}

// ── Progress ─────────────────────────────────────────────────────────────

export type Progress = 'not-started' | 'in-progress' | 'done' | 'skipped'

export function isFinished(p: Progress): boolean {
  return p === 'done' || p === 'skipped'
}

export function exerciseProgress(ex: DayExercise): Progress {
  if (ex.skipped) return 'skipped'
  const finished = ex.sets.filter((s) => s.status !== 'pending').length
  if (finished === ex.sets.length) return 'done'
  return finished > 0 ? 'in-progress' : 'not-started'
}

export function dayProgress(day: Day): Progress {
  if (day.skipped) return 'skipped'
  const states = day.exercises.map(exerciseProgress)
  if (states.every(isFinished)) return 'done'
  return states.some((s) => s !== 'not-started') ? 'in-progress' : 'not-started'
}

export function setCounts(day: Day): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const ex of day.exercises) {
    if (ex.skipped) continue
    for (const s of ex.sets) {
      total++
      if (s.status === 'done') done++
    }
  }
  return { done, total }
}

export interface DayPosition {
  weekIndex: number
  dayIndex: number
}

/**
 * Which day to train next. Finds the furthest day you've touched: if it's
 * unfinished, that's today's workout; otherwise it's the next unfinished day
 * after it. Returns null when the whole meso is finished.
 */
export function upNext(meso: Meso): DayPosition | null {
  const positions: DayPosition[] = []
  meso.weeks.forEach((w, weekIndex) => w.days.forEach((_, dayIndex) => positions.push({ weekIndex, dayIndex })))
  const progressAt = (p: DayPosition) => dayProgress(meso.weeks[p.weekIndex]!.days[p.dayIndex]!)

  let lastTouched = -1
  positions.forEach((p, i) => {
    if (progressAt(p) !== 'not-started') lastTouched = i
  })
  if (lastTouched !== -1 && progressAt(positions[lastTouched]!) === 'in-progress') return positions[lastTouched]!
  return positions.slice(lastTouched + 1).find((p) => !isFinished(progressAt(p))) ?? null
}

// ── Lookups ──────────────────────────────────────────────────────────────

export function findWeekIndex(meso: Meso, weekId: string): number {
  return meso.weeks.findIndex((w) => w.id === weekId)
}

export function findDay(meso: Meso, weekId: string, dayId: string): Day | undefined {
  return meso.weeks.find((w) => w.id === weekId)?.days.find((d) => d.id === dayId)
}

/** Lowercased, trimmed, single-spaced. "DB  Row " and "db row" are the same exercise. */
export function exerciseKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Every exercise name used in these mesos, for autocomplete. */
export function knownExerciseNames(mesos: Meso[]): string[] {
  const byKey = new Map<string, string>()
  for (const m of mesos)
    for (const w of m.weeks)
      for (const d of w.days)
        for (const ex of d.exercises) if (!byKey.has(exerciseKey(ex.name))) byKey.set(exerciseKey(ex.name), ex.name)
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}
