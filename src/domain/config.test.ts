import { describe, expect, it } from 'vitest'
import { makeBackup, parseBackup } from './backup'
import { configFromPlan, parseConfig } from './config'
import { EXAMPLE_CONFIG } from './exampleConfig'
import { createMeso } from './meso'
import { plan } from './testFixtures'

const parse = (value: unknown) => parseConfig(JSON.stringify(value))

describe('parseConfig', () => {
  it('reads the short form and fills in defaults', () => {
    const result = parse({ name: 'Meso 5', days: [{ name: 'Upper 1', exercises: [{ name: 'DB Row', sets: 2, reps: '8-12', weight: 95 }] }] })
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Meso 5',
        units: 'lb',
        trainingWeeks: 4,
        days: [
          {
            name: 'Upper 1',
            exercises: [
              {
                name: 'DB Row',
                sets: [
                  { targetReps: '8-12', targetRir: '', targetWeight: 95 },
                  { targetReps: '8-12', targetRir: '', targetWeight: 95 },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  it('reads the long form, with exercise-level values as fallbacks', () => {
    const result = parse({
      name: 'M',
      days: [{ name: 'D', exercises: [{ name: 'Pushdown', rir: '1', sets: [{ reps: 12 }, { reps: '10-15', rir: '0', weight: 50 }] }] }],
    })
    if (!result.ok) throw new Error(result.errors.join())
    expect(result.value.days[0]!.exercises[0]!.sets).toEqual([
      { targetReps: '12', targetRir: '1', targetWeight: null },
      { targetReps: '10-15', targetRir: '0', targetWeight: 50 },
    ])
  })

  it('points at exactly where a problem is', () => {
    const result = parse({ name: 'M', days: [{ name: 'D', exercises: [{ name: 'Row', sets: 3 }] }] })
    expect(result).toEqual({ ok: false, errors: ['days[0].exercises[0].reps: is required when "sets" is a number'] })
  })

  it('catches typos in field names instead of ignoring them', () => {
    const result = parse({ name: 'M', days: [{ name: 'D', exercises: [{ name: 'Row', sets: 3, rep: '8' }] }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('days[0].exercises[0]: unknown field "rep"')
  })

  it('reports a bad set inside the long form, not a vague union error', () => {
    const result = parse({ name: 'M', days: [{ name: 'D', exercises: [{ name: 'Row', sets: [{ reps: '8' }, { rir: '1' }] }] }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join('\n')).toMatch(/days\[0\]\.exercises\[0\]\.sets\[1\]\.reps/)
  })

  it('explains a wrong type in plain words', () => {
    const result = parse({ name: 'M', days: [{ name: 'D', exercises: [{ name: 'Row', sets: 'three', reps: '8' }] }] })
    expect(result).toEqual({ ok: false, errors: ['days[0].exercises[0].sets: should be a number of sets (like 3) or a list of sets'] })
  })

  it('rejects broken JSON with a readable message', () => {
    const result = parseConfig('{ "name": "M", ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/^Not valid JSON/)
  })

  it('accepts the bundled example', () => {
    expect(parse(EXAMPLE_CONFIG).ok).toBe(true)
  })
})

describe('configFromPlan', () => {
  it('round-trips through parseConfig unchanged', () => {
    expect(parse(configFromPlan(plan))).toEqual({ ok: true, value: plan })
  })

  it('uses the short form when every set is the same and the long form otherwise', () => {
    const config = configFromPlan({
      ...plan,
      days: [
        {
          name: 'D',
          exercises: [
            { name: 'Same', sets: [1, 2].map(() => ({ targetReps: '8', targetRir: '1', targetWeight: null })) },
            { name: 'Mixed', sets: [{ targetReps: '8', targetRir: '1', targetWeight: 50 }, { targetReps: '8', targetRir: '0', targetWeight: 50 }] },
          ],
        },
      ],
    })
    expect(config.days[0]!.exercises).toEqual([
      { name: 'Same', sets: 2, reps: '8', rir: '1' },
      { name: 'Mixed', sets: [{ reps: '8', rir: '1', weight: 50 }, { reps: '8', rir: '0', weight: 50 }] },
    ])
  })
})

describe('backups', () => {
  it('round-trips every meso, results included', () => {
    const mesos = [createMeso(plan), createMeso({ ...plan, name: 'Meso 6' })]
    expect(parseBackup(JSON.stringify(makeBackup(mesos)))).toEqual({ ok: true, value: mesos })
  })

  it('recognises a config file handed to the backup importer', () => {
    const result = parseBackup(JSON.stringify(EXAMPLE_CONFIG))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/config file/)
  })
})
