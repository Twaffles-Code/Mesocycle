// Changing a meso's structure after it's been created: editing a day's
// exercises, adding or removing a day. Each change can apply to one week only
// or to that week and every week after it (including the deload).

import { dayFromPlan, exerciseFromPlan, exerciseKey, findWeekIndex, setFromPlan } from './meso'
import { withChange } from './logging'
import type { Day, DayExercise, DayPlan, ExercisePlan, Meso, Week } from './types'

/** "this" = only the week you're editing. "remaining" = that week and all later ones. */
export type EditScope = 'this' | 'remaining'

function weeksInScope(draft: Meso, weekId: string, scope: EditScope): Week[] {
  const start = findWeekIndex(draft, weekId)
  if (start === -1) throw new Error('Week not found.')
  return scope === 'this' ? [draft.weeks[start]!] : draft.weeks.slice(start)
}

/**
 * Update an existing exercise from a plan so its logged sets survive: set N
 * keeps its results and only its targets change. Sets beyond the new count
 * are dropped; extra sets start pending.
 */
function mergeExercise(existing: DayExercise, plan: ExercisePlan): DayExercise {
  return {
    ...existing,
    name: plan.name.trim(),
    sets: plan.sets.map((setPlan, i) => {
      const old = existing.sets[i]
      return old ? { ...old, ...setPlan } : setFromPlan(setPlan)
    }),
  }
}

/**
 * Rebuild `day` from `plan`. In the week you're editing, exercises are matched
 * by id (so renaming one keeps its sets). In later weeks they're matched by
 * name, since each week has its own ids — which means swapping an exercise for
 * a different one starts it fresh, exactly as it should.
 */
function mergeDay(day: Day, plan: DayPlan, matchBy: 'id' | 'name'): void {
  const unused = [...day.exercises]
  day.name = plan.name.trim()
  day.exercises = plan.exercises.map((exPlan) => {
    const i = unused.findIndex((e) =>
      matchBy === 'id' ? exPlan.id !== undefined && e.id === exPlan.id : exerciseKey(e.name) === exerciseKey(exPlan.name),
    )
    const existing = i === -1 ? undefined : unused.splice(i, 1)[0]
    return existing ? mergeExercise(existing, exPlan) : exerciseFromPlan(exPlan)
  })
}

/** Replace a day's exercises with `plan`, here or here-and-after. Days are matched across weeks by position. */
export function applyDayPlan(meso: Meso, weekId: string, dayId: string, plan: DayPlan, scope: EditScope, now?: Date): Meso {
  if (!plan.name.trim()) throw new Error('A day needs a name.')
  return withChange(
    meso,
    (draft) => {
      const weeks = weeksInScope(draft, weekId, scope)
      const dayIndex = weeks[0]!.days.findIndex((d) => d.id === dayId)
      if (dayIndex === -1) throw new Error('Day not found.')
      weeks.forEach((week, i) => {
        const day = week.days[dayIndex]
        if (day) mergeDay(day, plan, i === 0 ? 'id' : 'name')
      })
    },
    now,
  )
}

/** How many already-logged sets an edit would throw away. Ask before saving if it's more than zero. */
export function loggedSetsLost(meso: Meso, weekId: string, dayId: string, plan: DayPlan, scope: EditScope): number {
  const after = applyDayPlan(meso, weekId, dayId, plan, scope)
  const count = (m: Meso) => {
    const weeks = weeksInScope(m, weekId, scope)
    return weeks.reduce(
      (n, w) => n + w.days.reduce((n2, d) => n2 + d.exercises.reduce((n3, e) => n3 + e.sets.filter((s) => s.status === 'done').length, 0), 0),
      0,
    )
  }
  return count(meso) - count(after)
}

/** Append a new day to this week, or this and every later week. */
export function addDay(meso: Meso, weekId: string, plan: DayPlan, scope: EditScope, now?: Date): Meso {
  if (!plan.name.trim()) throw new Error('A day needs a name.')
  return withChange(meso, (draft) => weeksInScope(draft, weekId, scope).forEach((w) => w.days.push(dayFromPlan(plan))), now)
}

/** Remove the day at this day's position, here or here-and-after. A week must keep at least one day. */
export function removeDay(meso: Meso, weekId: string, dayId: string, scope: EditScope, now?: Date): Meso {
  return withChange(
    meso,
    (draft) => {
      const weeks = weeksInScope(draft, weekId, scope)
      const dayIndex = weeks[0]!.days.findIndex((d) => d.id === dayId)
      if (dayIndex === -1) throw new Error('Day not found.')
      if (weeks[0]!.days.length <= 1) throw new Error('A week needs at least one day.')
      for (const w of weeks) if (w.days.length > 1 && w.days[dayIndex]) w.days.splice(dayIndex, 1)
    },
    now,
  )
}
