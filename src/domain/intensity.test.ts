import { describe, expect, it } from 'vitest'
import { INTENSITY_LEVELS, intensityEmoji, intensityOf } from './intensity'

describe('intensity', () => {
  it('maps every old numeric RIR to the nearest of three levels', () => {
    expect([0, 1, 2, 3, 4, 5, 8].map(intensityOf)).toEqual(['hard', 'target', 'target', 'easy', 'easy', 'easy', 'easy'])
    expect(intensityOf(null)).toBeNull()
  })

  it('stores values that map back to their own level', () => {
    for (const l of INTENSITY_LEVELS) expect(intensityOf(l.rir)).toBe(l.level)
  })

  it('shows an emoji for logged values and nothing when unset', () => {
    expect(intensityEmoji(0)).toBe('😤')
    expect(intensityEmoji(1)).toBe('🙂')
    expect(intensityEmoji(4)).toBe('🤔')
    expect(intensityEmoji(null)).toBe('')
  })
})
