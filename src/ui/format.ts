import type { SetPlan, Units, WorkoutSet } from '../domain/types'

/** 75 → "75", 77.5 → "77.5", null → "–" */
export function num(n: number | null | undefined): string {
  return n === null || n === undefined ? '–' : String(Number(n.toFixed(2)))
}

/** "8-12 reps · RIR 1-2 · 75 lb" — skips whatever isn't set. */
export function setTarget(s: SetPlan, units: Units): string {
  const parts = [`${s.targetReps} reps`]
  if (s.targetRir) parts.push(`RIR ${s.targetRir}`)
  if (s.targetWeight !== null) parts.push(`${num(s.targetWeight)} ${units}`)
  return parts.join(' · ')
}

/** "3 × 8-12 · RIR 1-2" when every set matches, otherwise "3 sets · 8-12 / 8-12 / 10-15". */
export function exerciseTarget(sets: SetPlan[], units: Units): string {
  const first = sets[0]
  if (!first) return 'No sets'
  const same = sets.every((s) => s.targetReps === first.targetReps && s.targetRir === first.targetRir && s.targetWeight === first.targetWeight)
  if (same) {
    const extra = [first.targetRir ? `RIR ${first.targetRir}` : '', first.targetWeight !== null ? `${num(first.targetWeight)} ${units}` : '']
    return [`${sets.length} × ${first.targetReps}`, ...extra.filter(Boolean)].join(' · ')
  }
  return `${sets.length} sets · ${sets.map((s) => s.targetReps).join(' / ')}`
}

/** "75 × 11 @ 2" */
export function performed(s: Pick<WorkoutSet, 'weight' | 'reps' | 'rir'>, units: Units): string {
  const load = s.weight === null ? 'BW' : `${num(s.weight)} ${units}`
  return `${load} × ${num(s.reps)}${s.rir === null ? '' : ` @ RIR ${s.rir}`}`
}

/** Turns text from a number box into a number. Accepts "77,5" because some iPhone keypads type commas. */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
