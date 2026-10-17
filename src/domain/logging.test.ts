import { describe, expect, it } from 'vitest'
import { createMeso, exerciseProgress } from './meso'
import {
  logSet,
  nextExercise,
  nextPendingSetIndex,
  previousPerformance,
  resetSet,
  setDayNotes,
  setDaySkipped,
  setExerciseSkipped,
  skipSet,
  suggestedEntry,
  type SetRef,
} from './logging'
import { plan } from './testFixtures'
import type { Meso } from './types'

/** Ref to set `s` of exercise `e` on day `d` of week `w`. */
function ref(meso: Meso, w: number, d: number, e: number, s: number): SetRef {
  const week = meso.weeks[w]!
  const day = week.days[d]!
  const ex = day.exercises[e]!
  return { weekId: week.id, dayId: day.id, exerciseId: ex.id, setId: ex.sets[s]!.id }
}

const benchSet = (m: Meso, w: number, s: number) => m.weeks[w]!.days[0]!.exercises[0]!.sets[s]!

describe('logging sets', () => {
  it('records weight, reps and RIR and marks the set done', () => {
    const meso = createMeso(plan)
    const after = logSet(meso, ref(meso, 0, 0, 0, 0), { weight: 75, reps: 11, rir: 2 })
    expect(benchSet(after, 0, 0)).toMatchObject({ weight: 75, reps: 11, rir: 2, status: 'done' })
    expect(benchSet(meso, 0, 0).status).toBe('pending') // original untouched
  })

  it('skips and resets a set', () => {
    const meso = createMeso(plan)
    const r = ref(meso, 0, 0, 0, 1)
    const skipped = skipSet(meso, r)
    expect(benchSet(skipped, 0, 1).status).toBe('skipped')
    expect(benchSet(resetSet(skipped, r), 0, 1)).toMatchObject({ status: 'pending', weight: null })
  })

  it('un-skips the exercise and day when you log into them', () => {
    let meso = createMeso(plan)
    const w = meso.weeks[0]!
    meso = setDaySkipped(meso, w.id, w.days[0]!.id, true)
    meso = setExerciseSkipped(meso, w.id, w.days[0]!.id, w.days[0]!.exercises[0]!.id, true)
    meso = logSet(meso, ref(meso, 0, 0, 0, 0), { weight: 75, reps: 10, rir: 1 })
    expect(meso.weeks[0]!.days[0]!.skipped).toBe(false)
    expect(meso.weeks[0]!.days[0]!.exercises[0]!.skipped).toBe(false)
  })

  it('saves day notes', () => {
    const meso = createMeso(plan)
    const w = meso.weeks[0]!
    expect(setDayNotes(meso, w.id, w.days[0]!.id, 'Shoulder tight').weeks[0]!.days[0]!.notes).toBe('Shoulder tight')
  })
})

describe('moving through a workout', () => {
  it('finds the next pending set, past skipped ones', () => {
    let meso = createMeso(plan)
    meso = skipSet(meso, ref(meso, 0, 0, 0, 0))
    expect(nextPendingSetIndex(meso.weeks[0]!.days[0]!.exercises[0]!)).toBe(1)
  })

  it('suggests the next unfinished exercise, wrapping round to ones you jumped past', () => {
    let meso = createMeso(plan)
    const day = () => meso.weeks[0]!.days[0]!
    expect(nextExercise(day(), day().exercises[0]!.id)?.name).toBe('DB Row')
    // Do DB Row first, then the suggestion after it should wrap back to the bench.
    meso = logSet(meso, ref(meso, 0, 0, 1, 0), { weight: 90, reps: 10, rir: 2 })
    meso = logSet(meso, ref(meso, 0, 0, 1, 1), { weight: 90, reps: 10, rir: 2 })
    expect(exerciseProgress(day().exercises[1]!)).toBe('done')
    expect(nextExercise(day(), day().exercises[1]!.id)?.name).toBe('Incline DB Bench')
  })

  it('suggests nothing once every exercise is done or skipped', () => {
    let meso = createMeso(plan)
    const w = meso.weeks[0]!
    for (const ex of w.days[0]!.exercises) meso = setExerciseSkipped(meso, w.id, w.days[0]!.id, ex.id, true)
    expect(nextExercise(meso.weeks[0]!.days[0]!)).toBeNull()
  })
})

describe('suggested numbers', () => {
  it('uses the plan weight before anything is logged', () => {
    const meso = createMeso(plan)
    expect(suggestedEntry(meso, ref(meso, 0, 0, 0, 0))).toEqual({ weight: 75, reps: null, rir: null })
  })

  it('carries the weight from the set you just did', () => {
    let meso = createMeso(plan)
    meso = logSet(meso, ref(meso, 0, 0, 0, 0), { weight: 80, reps: 9, rir: 1 })
    expect(suggestedEntry(meso, ref(meso, 0, 0, 0, 1)).weight).toBe(80)
  })

  it("uses last week's weight for the same set", () => {
    let meso = createMeso(plan)
    meso = logSet(meso, ref(meso, 0, 0, 0, 2), { weight: 70, reps: 12, rir: 2 })
    expect(previousPerformance(meso, ref(meso, 1, 0, 0, 2))).toEqual({ weight: 70, reps: 12, rir: 2, weekIndex: 0 })
    expect(suggestedEntry(meso, ref(meso, 1, 0, 0, 2)).weight).toBe(70)
  })

  it('shows a logged set as it was logged', () => {
    let meso = createMeso(plan)
    meso = logSet(meso, ref(meso, 0, 0, 0, 0), { weight: 77.5, reps: 8, rir: 0 })
    expect(suggestedEntry(meso, ref(meso, 0, 0, 0, 0))).toEqual({ weight: 77.5, reps: 8, rir: 0 })
  })
})
