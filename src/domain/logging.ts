// Recording a workout: logging sets, skipping things, and suggesting numbers.

import { exerciseKey, exerciseProgress, findWeekIndex, isFinished } from './meso'
import type { Day, DayExercise, Meso, WorkoutSet } from './types'

/** Where a set lives. Ids, not positions, so reordering exercises never mixes up results. */
export interface SetRef {
  weekId: string
  dayId: string
  exerciseId: string
  setId: string
}

export interface SetEntry {
  weight: number | null
  reps: number | null
  rir: number | null
}

/**
 * Copy the meso, let `change` edit the copy, stamp the time, and return it.
 * The original is untouched — React relies on that to know something changed.
 */
export function withChange(meso: Meso, change: (draft: Meso) => void, now: Date = new Date()): Meso {
  const draft = structuredClone(meso)
  change(draft)
  draft.updatedAt = now.toISOString()
  return draft
}

function dayIn(draft: Meso, weekId: string, dayId: string): Day {
  const day = draft.weeks.find((w) => w.id === weekId)?.days.find((d) => d.id === dayId)
  if (!day) throw new Error('Day not found.')
  return day
}

function exerciseIn(draft: Meso, weekId: string, dayId: string, exerciseId: string): DayExercise {
  const ex = dayIn(draft, weekId, dayId).exercises.find((e) => e.id === exerciseId)
  if (!ex) throw new Error('Exercise not found.')
  return ex
}

function setIn(draft: Meso, ref: SetRef): WorkoutSet {
  const set = exerciseIn(draft, ref.weekId, ref.dayId, ref.exerciseId).sets.find((s) => s.id === ref.setId)
  if (!set) throw new Error('Set not found.')
  return set
}

// ── Sets ─────────────────────────────────────────────────────────────────

export function logSet(meso: Meso, ref: SetRef, entry: SetEntry, now?: Date): Meso {
  return withChange(
    meso,
    (draft) => {
      const set = setIn(draft, ref)
      set.weight = entry.weight
      set.reps = entry.reps
      set.rir = entry.rir
      set.status = 'done'
      // Logging a set means you're doing this exercise after all.
      exerciseIn(draft, ref.weekId, ref.dayId, ref.exerciseId).skipped = false
      dayIn(draft, ref.weekId, ref.dayId).skipped = false
    },
    now,
  )
}

export function skipSet(meso: Meso, ref: SetRef, now?: Date): Meso {
  return withChange(
    meso,
    (draft) => {
      const set = setIn(draft, ref)
      set.status = 'skipped'
      set.weight = null
      set.reps = null
      set.rir = null
    },
    now,
  )
}

/** Undo a logged or skipped set: back to pending, results cleared. */
export function resetSet(meso: Meso, ref: SetRef, now?: Date): Meso {
  return withChange(
    meso,
    (draft) => {
      const set = setIn(draft, ref)
      set.status = 'pending'
      set.weight = null
      set.reps = null
      set.rir = null
    },
    now,
  )
}

// ── Exercises and days ───────────────────────────────────────────────────

export function setExerciseSkipped(meso: Meso, weekId: string, dayId: string, exerciseId: string, skipped: boolean, now?: Date): Meso {
  return withChange(meso, (draft) => void (exerciseIn(draft, weekId, dayId, exerciseId).skipped = skipped), now)
}

export function setDaySkipped(meso: Meso, weekId: string, dayId: string, skipped: boolean, now?: Date): Meso {
  return withChange(meso, (draft) => void (dayIn(draft, weekId, dayId).skipped = skipped), now)
}

export function setDayNotes(meso: Meso, weekId: string, dayId: string, notes: string, now?: Date): Meso {
  return withChange(meso, (draft) => void (dayIn(draft, weekId, dayId).notes = notes), now)
}

// ── Navigation ───────────────────────────────────────────────────────────

/** Index of the first set still to do, or -1 when every set is logged or skipped. */
export function nextPendingSetIndex(ex: DayExercise): number {
  return ex.sets.findIndex((s) => s.status === 'pending')
}

/**
 * The exercise to suggest after `currentId`: the next unfinished one in the
 * day's order, wrapping round to any you jumped past. Null when the day's done.
 */
export function nextExercise(day: Day, currentId?: string): DayExercise | null {
  const start = currentId ? day.exercises.findIndex((e) => e.id === currentId) + 1 : 0
  const ordered = [...day.exercises.slice(start), ...day.exercises.slice(0, start)]
  return ordered.find((e) => e.id !== currentId && !isFinished(exerciseProgress(e))) ?? null
}

// ── Suggestions ──────────────────────────────────────────────────────────

export interface PreviousSet {
  weight: number | null
  reps: number | null
  rir: number | null
  /** Index of the week it came from; pass it to weekLabel() to show "Week 2". */
  weekIndex: number
}

/**
 * The same set (same exercise name, same set number) from the most recent
 * earlier week where it was logged. Checks the same day slot first, then any day.
 */
export function previousPerformance(meso: Meso, ref: SetRef): PreviousSet | null {
  const weekIndex = findWeekIndex(meso, ref.weekId)
  const week = meso.weeks[weekIndex]
  const dayIndex = week?.days.findIndex((d) => d.id === ref.dayId) ?? -1
  const ex = week?.days[dayIndex]?.exercises.find((e) => e.id === ref.exerciseId)
  const setIndex = ex?.sets.findIndex((s) => s.id === ref.setId) ?? -1
  if (!ex || setIndex === -1) return null
  const key = exerciseKey(ex.name)

  for (let w = weekIndex - 1; w >= 0; w--) {
    const days = meso.weeks[w]!.days
    const sameSlotFirst = [days[dayIndex], ...days.filter((_, i) => i !== dayIndex)]
    for (const day of sameSlotFirst) {
      const match = day?.exercises.find((e) => exerciseKey(e.name) === key)
      const set = match?.sets[setIndex]
      if (set?.status === 'done') return { weight: set.weight, reps: set.reps, rir: set.rir, weekIndex: w }
    }
  }
  return null
}

/**
 * What to pre-fill in the logger. A logged set shows its own numbers. Otherwise
 * weight comes from the set you just did, else last week, else the plan; reps
 * and RIR are left for you to type, because those are the honest part.
 */
export function suggestedEntry(meso: Meso, ref: SetRef): SetEntry {
  const ex = meso.weeks.find((w) => w.id === ref.weekId)?.days.find((d) => d.id === ref.dayId)?.exercises.find((e) => e.id === ref.exerciseId)
  const setIndex = ex?.sets.findIndex((s) => s.id === ref.setId) ?? -1
  const set = ex?.sets[setIndex]
  if (!ex || !set) return { weight: null, reps: null, rir: null }
  if (set.status === 'done') return { weight: set.weight, reps: set.reps, rir: set.rir }

  const earlierThisSession = ex.sets.slice(0, setIndex).filter((s) => s.status === 'done').at(-1)
  const weight = earlierThisSession?.weight ?? previousPerformance(meso, ref)?.weight ?? set.targetWeight
  return { weight: weight ?? null, reps: null, rir: null }
}
