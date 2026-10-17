// Shared test data. Not a test file itself, so vitest doesn't run it.
import { logSet } from './logging'
import type { Meso, MesoPlan } from './types'

export const plan: MesoPlan = {
  name: 'Meso 5',
  units: 'lb',
  trainingWeeks: 4,
  days: [
    {
      name: 'Upper 1',
      exercises: [
        { name: 'Incline DB Bench', sets: [1, 2, 3].map(() => ({ targetReps: '8-12', targetRir: '1-2', targetWeight: 75 })) },
        { name: 'DB Row', sets: [1, 2].map(() => ({ targetReps: '8-12', targetRir: '1-2', targetWeight: null })) },
      ],
    },
    { name: 'Lower 1', exercises: [{ name: 'BB RDL', sets: [{ targetReps: '8-12', targetRir: '2', targetWeight: 155 }] }] },
  ],
}

/** Log every set in a day so it counts as done. */
export function finishDay(meso: Meso, weekIndex: number, dayIndex: number): Meso {
  const week = meso.weeks[weekIndex]!
  const day = week.days[dayIndex]!
  let m = meso
  for (const ex of day.exercises)
    for (const s of ex.sets) m = logSet(m, { weekId: week.id, dayId: day.id, exerciseId: ex.id, setId: s.id }, { weight: 100, reps: 10, rir: 2 })
  return m
}
