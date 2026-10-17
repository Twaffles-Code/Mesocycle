// Helpers for plans being edited on screen.

import { newId } from '../domain/ids'
import type { DayPlan, ExercisePlan, SetPlan } from '../domain/types'

export const EXERCISE_NAMES_LIST = 'exercise-names'

export const DEFAULT_SET: SetPlan = { targetReps: '8-12', targetRir: '2', targetWeight: null }

/** A blank exercise. It gets a throwaway id purely so the list has stable keys; ids that match nothing are treated as new. */
export function blankExercise(): ExercisePlan {
  return { id: newId(), name: '', sets: [DEFAULT_SET, DEFAULT_SET, DEFAULT_SET] }
}

/** Give exercises without an id a throwaway one, for the same reason. */
export function withKeys(plan: DayPlan): DayPlan {
  return { ...plan, exercises: plan.exercises.map((e) => (e.id ? e : { ...e, id: newId() })) }
}
