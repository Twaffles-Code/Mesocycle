/** Turns "weeks until the deload" into words. 0 = this week, negative = already behind you. */
export function deloadText(weeksUntil: number): string {
  if (weeksUntil < 0) return 'Deload done'
  if (weeksUntil === 0) return 'Deload this week'
  if (weeksUntil === 1) return 'Deload next week'
  return `Deload in ${weeksUntil} weeks`
}
