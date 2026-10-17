import { describe, expect, it } from 'vitest'
import { addDay, applyDayPlan, loggedSetsLost, removeDay } from './editing'
import { logSet } from './logging'
import { createMeso, planFromDay } from './meso'
import { plan } from './testFixtures'
import type { DayPlan, Meso } from './types'

const upper = (m: Meso, w: number) => m.weeks[w]!.days[0]!

function logFirstBenchSet(meso: Meso, week = 0): Meso {
  const w = meso.weeks[week]!
  const d = w.days[0]!
  const ex = d.exercises[0]!
  return logSet(meso, { weekId: w.id, dayId: d.id, exerciseId: ex.id, setId: ex.sets[0]!.id }, { weight: 75, reps: 11, rir: 2 })
}

/** The Upper 1 plan with the bench swapped for a machine press. */
function swapBench(meso: Meso, week: number): DayPlan {
  const p = planFromDay(upper(meso, week))
  p.exercises[0] = { name: 'Machine Chest Press', sets: p.exercises[0]!.sets }
  return p
}

describe('applyDayPlan', () => {
  it("'this' changes only the week being edited", () => {
    const meso = createMeso(plan)
    const after = applyDayPlan(meso, meso.weeks[1]!.id, upper(meso, 1).id, swapBench(meso, 1), 'this')
    expect(after.weeks.map((w) => w.days[0]!.exercises[0]!.name)).toEqual([
      'Incline DB Bench',
      'Machine Chest Press',
      'Incline DB Bench',
      'Incline DB Bench',
      'Incline DB Bench',
    ])
  })

  it("'remaining' changes that week and every later one, deload included", () => {
    const meso = createMeso(plan)
    const after = applyDayPlan(meso, meso.weeks[2]!.id, upper(meso, 2).id, swapBench(meso, 2), 'remaining')
    expect(after.weeks.map((w) => w.days[0]!.exercises[0]!.name)).toEqual([
      'Incline DB Bench',
      'Incline DB Bench',
      'Machine Chest Press',
      'Machine Chest Press',
      'Machine Chest Press',
    ])
  })

  it('keeps logged sets when an exercise is renamed or its targets change', () => {
    const meso = logFirstBenchSet(createMeso(plan))
    const p = planFromDay(upper(meso, 0))
    p.exercises[0]!.name = 'Incline Dumbbell Bench'
    p.exercises[0]!.sets[0]!.targetReps = '6-8'
    const set = upper(applyDayPlan(meso, meso.weeks[0]!.id, upper(meso, 0).id, p, 'this'), 0).exercises[0]!.sets[0]!
    expect(set).toMatchObject({ weight: 75, reps: 11, status: 'done', targetReps: '6-8' })
  })

  it('a swapped-in exercise starts fresh; the old one keeps its history in earlier weeks', () => {
    const meso = logFirstBenchSet(createMeso(plan), 1)
    const after = applyDayPlan(meso, meso.weeks[2]!.id, upper(meso, 2).id, swapBench(meso, 2), 'remaining')
    expect(upper(after, 1).exercises[0]!.sets[0]!.status).toBe('done')
    expect(upper(after, 2).exercises[0]!.sets.every((s) => s.status === 'pending')).toBe(true)
  })

  it('adds and removes sets', () => {
    const meso = createMeso(plan)
    const p = planFromDay(upper(meso, 0))
    p.exercises[1]!.sets.push({ targetReps: '8-12', targetRir: '0', targetWeight: null })
    p.exercises[0]!.sets.pop()
    const after = upper(applyDayPlan(meso, meso.weeks[0]!.id, upper(meso, 0).id, p, 'this'), 0)
    expect(after.exercises.map((e) => e.sets.length)).toEqual([2, 3])
  })

  it('counts the logged sets an edit would throw away', () => {
    const meso = logFirstBenchSet(createMeso(plan))
    const p = planFromDay(upper(meso, 0))
    p.exercises.shift()
    expect(loggedSetsLost(meso, meso.weeks[0]!.id, upper(meso, 0).id, p, 'this')).toBe(1)
  })
})

describe('adding and removing days', () => {
  it('adds a day to this and later weeks', () => {
    const meso = createMeso(plan)
    const extra: DayPlan = { name: 'Arms', exercises: [{ name: 'BB Curl', sets: [{ targetReps: '10', targetRir: '1', targetWeight: 70 }] }] }
    const after = addDay(meso, meso.weeks[3]!.id, extra, 'remaining')
    expect(after.weeks.map((w) => w.days.length)).toEqual([2, 2, 2, 3, 3])
  })

  it('removes a day but never the last one', () => {
    const meso = createMeso(plan)
    const after = removeDay(meso, meso.weeks[0]!.id, upper(meso, 0).id, 'remaining')
    expect(after.weeks.every((w) => w.days.length === 1 && w.days[0]!.name === 'Lower 1')).toBe(true)
    expect(() => removeDay(after, after.weeks[0]!.id, after.weeks[0]!.days[0]!.id, 'this')).toThrow()
  })
})
