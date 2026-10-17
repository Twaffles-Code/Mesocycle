// Checks for plans built in the in-app editors. The messages name things the
// way the screen shows them ("Day 2 · Lower 1"), not the way the file stores them.

import type { DayPlan, MesoPlan } from './types'

export function dayPlanProblems(day: DayPlan, label = day.name.trim() || 'This day'): string[] {
  const problems: string[] = []
  if (!day.name.trim()) problems.push(`${label} needs a name.`)
  if (day.exercises.length === 0) problems.push(`${label} needs at least one exercise.`)
  day.exercises.forEach((ex, i) => {
    const exLabel = ex.name.trim() || `exercise ${i + 1}`
    if (!ex.name.trim()) problems.push(`${label}: exercise ${i + 1} needs a name.`)
    if (ex.sets.length === 0) problems.push(`${label}: ${exLabel} needs at least one set.`)
    ex.sets.forEach((s, j) => {
      if (!s.targetReps.trim()) problems.push(`${label}: ${exLabel}, set ${j + 1} needs a rep target.`)
    })
  })
  return problems
}

export function mesoPlanProblems(plan: MesoPlan): string[] {
  const problems: string[] = []
  if (!plan.name.trim()) problems.push('The meso needs a name.')
  if (plan.trainingWeeks < 1) problems.push('The meso needs at least one training week.')
  if (plan.days.length === 0) problems.push('The meso needs at least one day.')
  plan.days.forEach((d, i) => problems.push(...dayPlanProblems(d, `Day ${i + 1}${d.name.trim() ? ` · ${d.name.trim()}` : ''}`)))
  return problems
}
