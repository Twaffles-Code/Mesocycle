import { describe, expect, it } from 'vitest'
import {
  addWeek,
  createMeso,
  dayProgress,
  planFromMeso,
  removeWeek,
  suggestNextName,
  upNext,
  weekLabel,
  weeksUntilDeload,
} from './meso'
import { logSet, setDaySkipped, skipSet } from './logging'
import { finishDay, plan } from './testFixtures'

describe('createMeso', () => {
  it('builds four training weeks and a deload, deload last', () => {
    const meso = createMeso(plan)
    expect(meso.weeks.map((w) => w.isDeload)).toEqual([false, false, false, false, true])
  })

  it('gives every week its own copy of the days, with fresh ids and nothing logged', () => {
    const meso = createMeso(plan)
    const ids = meso.weeks.flatMap((w) => w.days.flatMap((d) => [d.id, ...d.exercises.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)])]))
    expect(new Set(ids).size).toBe(ids.length)
    expect(meso.weeks.every((w) => w.days.length === 2)).toBe(true)
    expect(meso.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.flatMap((e) => e.sets))).every((s) => s.status === 'pending')).toBe(true)
  })

  it('honours a custom number of training weeks', () => {
    expect(createMeso({ ...plan, trainingWeeks: 6 }).weeks).toHaveLength(7)
  })

  it('refuses a meso with no days or no name', () => {
    expect(() => createMeso({ ...plan, days: [] })).toThrow()
    expect(() => createMeso({ ...plan, name: '  ' })).toThrow()
  })
})

describe('week labels', () => {
  it('numbers training weeks and labels the deload', () => {
    const meso = createMeso(plan)
    expect(meso.weeks.map((_, i) => weekLabel(meso, i))).toEqual(['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Deload'])
  })

  it('counts down to the deload', () => {
    const meso = createMeso(plan)
    expect(meso.weeks.map((_, i) => weeksUntilDeload(meso, i))).toEqual([4, 3, 2, 1, 0])
  })
})

describe('addWeek', () => {
  it('inserts a training week just before the deload', () => {
    const meso = addWeek(createMeso(plan))
    expect(meso.weeks.map((w) => w.isDeload)).toEqual([false, false, false, false, false, true])
    expect(weekLabel(meso, 4)).toBe('Week 5')
  })

  it('copies the latest training week structure without its results', () => {
    let meso = createMeso(plan)
    meso = finishDay(meso, 3, 0)
    const added = addWeek(meso).weeks[4]!
    expect(added.days.map((d) => d.name)).toEqual(['Upper 1', 'Lower 1'])
    expect(added.days[0]!.exercises.map((e) => e.sets.length)).toEqual([3, 2])
    expect(added.days.flatMap((d) => d.exercises.flatMap((e) => e.sets)).every((s) => s.status === 'pending' && s.weight === null)).toBe(true)
  })

  it('does not change the meso it was given', () => {
    const meso = createMeso(plan)
    addWeek(meso)
    expect(meso.weeks).toHaveLength(5)
  })
})

describe('removeWeek', () => {
  it('removes a training week', () => {
    const meso = createMeso(plan)
    expect(removeWeek(meso, meso.weeks[1]!.id).weeks).toHaveLength(4)
  })

  it('never removes the deload or the last training week', () => {
    const meso = createMeso({ ...plan, trainingWeeks: 1 })
    expect(() => removeWeek(meso, meso.weeks[1]!.id)).toThrow(/deload/)
    expect(() => removeWeek(meso, meso.weeks[0]!.id)).toThrow(/at least one/)
  })
})

describe('progress and upNext', () => {
  it('starts at week 1, day 1', () => {
    expect(upNext(createMeso(plan))).toEqual({ weekIndex: 0, dayIndex: 0 })
  })

  it('stays on a day that is part-way done', () => {
    const meso = createMeso(plan)
    const w = meso.weeks[0]!
    const d = w.days[0]!
    const ex = d.exercises[0]!
    const started = logSet(meso, { weekId: w.id, dayId: d.id, exerciseId: ex.id, setId: ex.sets[0]!.id }, { weight: 75, reps: 10, rir: 2 })
    expect(dayProgress(started.weeks[0]!.days[0]!)).toBe('in-progress')
    expect(upNext(started)).toEqual({ weekIndex: 0, dayIndex: 0 })
  })

  it('moves on after a finished or skipped day, across weeks', () => {
    let meso = finishDay(createMeso(plan), 0, 0)
    expect(upNext(meso)).toEqual({ weekIndex: 0, dayIndex: 1 })
    meso = setDaySkipped(meso, meso.weeks[0]!.id, meso.weeks[0]!.days[1]!.id, true)
    expect(upNext(meso)).toEqual({ weekIndex: 1, dayIndex: 0 })
  })

  it('counts skipped sets as finished', () => {
    const meso = createMeso({ ...plan, days: [plan.days[1]!] })
    const w = meso.weeks[0]!
    const d = w.days[0]!
    const ex = d.exercises[0]!
    const skipped = skipSet(meso, { weekId: w.id, dayId: d.id, exerciseId: ex.id, setId: ex.sets[0]!.id })
    expect(dayProgress(skipped.weeks[0]!.days[0]!)).toBe('done')
  })

  it('returns null when every day is finished', () => {
    let meso = createMeso({ ...plan, trainingWeeks: 1 })
    meso.weeks.forEach((w, wi) => w.days.forEach((_, di) => (meso = finishDay(meso, wi, di))))
    expect(upNext(meso)).toBeNull()
  })
})

describe('suggestNextName', () => {
  it('bumps the last number in the name', () => {
    expect(suggestNextName('Meso 5')).toBe('Meso 6')
    expect(suggestNextName('Meso 4 - Mass 1')).toBe('Meso 4 - Mass 2')
    expect(suggestNextName('Strength block')).toBe('Strength block (next)')
  })
})

describe('planFromMeso', () => {
  it('takes structure from the last training week and drops ids', () => {
    const p = planFromMeso(addWeek(createMeso(plan)))
    expect(p.trainingWeeks).toBe(5)
    expect(p.days[0]!.exercises[0]).toEqual({ name: 'Incline DB Bench', sets: plan.days[0]!.exercises[0]!.sets })
  })
})
