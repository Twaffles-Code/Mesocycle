// The shape of all workout data. These are plain data types: no behaviour,
// no React, no storage. Everything else in the app is built around them.
//
//   Meso ─┬─ Week ─┬─ Day ─┬─ DayExercise ─┬─ WorkoutSet
//         │        │       │               └─ WorkoutSet ...
//         │        │       └─ DayExercise ...
//         │        └─ Day ...
//         └─ Week (deload, always last)

export type Units = 'lb' | 'kg'

/** pending = not done yet, done = logged, skipped = deliberately not done. */
export type SetStatus = 'pending' | 'done' | 'skipped'

export interface WorkoutSet {
  id: string
  /** The plan. Text, because coaches write ranges like "8-12". */
  targetReps: string
  /** The plan. Text for the same reason: "1-2". */
  targetRir: string
  /** Optional planned load. Null means "pick on the day". */
  targetWeight: number | null
  /** What actually happened. Null until the set is logged. */
  weight: number | null
  reps: number | null
  rir: number | null
  status: SetStatus
}

export interface DayExercise {
  id: string
  name: string
  skipped: boolean
  sets: WorkoutSet[]
}

export interface Day {
  id: string
  name: string
  notes: string
  skipped: boolean
  exercises: DayExercise[]
}

export interface Week {
  id: string
  /** A recovery week. The app only labels it; how you run it is up to you. */
  isDeload: boolean
  days: Day[]
}

export interface Meso {
  id: string
  name: string
  units: Units
  createdAt: string
  updatedAt: string
  /** Training weeks in order, with the deload week always last. */
  weeks: Week[]
}

// ── Plans ────────────────────────────────────────────────────────────────
// A "plan" is the structure without any logged results. It's what a config
// file describes, what the editors produce, and what a new week is built from.

export interface SetPlan {
  targetReps: string
  targetRir: string
  targetWeight: number | null
}

export interface ExercisePlan {
  /** Set when the plan was made from an existing exercise, so edits keep its logged sets. */
  id?: string
  name: string
  sets: SetPlan[]
}

export interface DayPlan {
  name: string
  exercises: ExercisePlan[]
}

export interface MesoPlan {
  name: string
  units: Units
  /** Weeks before the deload. Defaults to 4. */
  trainingWeeks: number
  days: DayPlan[]
}
