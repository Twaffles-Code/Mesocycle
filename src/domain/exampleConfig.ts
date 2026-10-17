import type { MesoConfig } from './config'

/**
 * A starting point you can download from the app, edit, and import.
 * It is deliberately tiny: two days and a few exercises. Add your own.
 */
export const EXAMPLE_CONFIG: MesoConfig = {
  version: 1,
  name: 'Meso 1 - Example',
  units: 'lb',
  trainingWeeks: 4,
  days: [
    {
      name: 'Upper',
      exercises: [
        { name: 'Bench Press', sets: 3, reps: '8-12', rir: '1-2', weight: 135 },
        { name: 'DB Row', sets: 3, reps: '8-12', rir: '1-2' },
      ],
    },
    {
      name: 'Lower',
      exercises: [{ name: 'Squat', sets: 3, reps: '8-12', rir: '2', weight: 185 }],
    },
  ],
}
