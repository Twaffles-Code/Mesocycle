import { describe, expect, it } from 'vitest'
import { plan } from './testFixtures'
import { mesoPlanProblems } from './validation'

describe('mesoPlanProblems', () => {
  it('passes a complete plan', () => {
    expect(mesoPlanProblems(plan)).toEqual([])
  })

  it('names each problem the way the screen shows it', () => {
    const broken = {
      ...plan,
      name: '',
      days: [
        { name: 'Upper 1', exercises: [{ name: '', sets: [{ targetReps: '', targetRir: '', targetWeight: null }] }] },
        { name: '', exercises: [] },
      ],
    }
    expect(mesoPlanProblems(broken)).toEqual([
      'The meso needs a name.',
      'Day 1 · Upper 1: exercise 1 needs a name.',
      'Day 1 · Upper 1: exercise 1, set 1 needs a rep target.',
      'Day 2 needs a name.',
      'Day 2 needs at least one exercise.',
    ])
  })
})
