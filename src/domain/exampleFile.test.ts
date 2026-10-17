import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXAMPLE_CONFIG } from './exampleConfig'

// examples/meso-config.example.json is the copy you edit on a computer. This
// keeps it identical to the one the app hands out, so the two never drift.
describe('examples/meso-config.example.json', () => {
  it('matches the in-app example', () => {
    const file = JSON.parse(readFileSync(new URL('../../examples/meso-config.example.json', import.meta.url), 'utf8'))
    expect(file).toEqual(EXAMPLE_CONFIG)
  })
})
