// The set logger's 3-level "Intensity" picker. Under the hood it is still reps in
// reserve (stored as the numeric `rir` on each set), so old data and backups
// keep working: any stored number maps to the nearest of the three levels.

export type Intensity = 'easy' | 'target' | 'hard'

/** Left to right as shown in the picker. `rir` is the value stored when picked. */
export const INTENSITY_LEVELS: readonly { level: Intensity; rir: number; emoji: string; label: string }[] = [
  { level: 'easy', rir: 3, emoji: '😕', label: 'Easy, plenty left' },
  { level: 'target', rir: 2, emoji: '🙂', label: 'On target' },
  { level: 'hard', rir: 0, emoji: '😤', label: 'Hit the limit' },
]

/** Any stored rir (0, 1, 2, 3, 4, 5+…) → its level. 0 → hard, 1-2 → on target, 3+ → easy. */
export function intensityOf(rir: number | null): Intensity | null {
  if (rir === null) return null
  if (rir <= 0) return 'hard'
  if (rir <= 2) return 'target'
  return 'easy'
}

export function intensityEmoji(rir: number | null): string {
  const level = intensityOf(rir)
  return INTENSITY_LEVELS.find((l) => l.level === level)?.emoji ?? ''
}
