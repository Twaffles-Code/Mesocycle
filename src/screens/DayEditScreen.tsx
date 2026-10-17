import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDay, applyDayPlan, loggedSetsLost, removeDay, type EditScope } from '../domain/editing'
import { planFromDay, weekLabel } from '../domain/meso'
import type { DayPlan } from '../domain/types'
import { dayPlanProblems } from '../domain/validation'
import { NotFound, ProblemList, Screen, Segmented } from '../ui/components'
import { DayPlanEditor } from '../ui/DayPlanEditor'
import { blankExercise, withKeys } from '../ui/planDrafts'
import { paths, useRouteData } from '../ui/useRouteData'

/** Edits an existing day, or — with mode="new" — adds a day to a week. */
export function DayEditScreen({ mode }: { mode: 'edit' | 'new' }) {
  const { store, meso, week, weekIndex, day } = useRouteData()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<DayPlan | null>(() =>
    mode === 'edit' ? (day ? withKeys(planFromDay(day)) : null) : { name: `Day ${(week?.days.length ?? 0) + 1}`, exercises: [blankExercise()] },
  )
  // Most edits (swapping an exercise, changing a target) should carry forward. The deload is usually its own thing.
  const [scope, setScope] = useState<EditScope>(week?.isDeload ? 'this' : 'remaining')
  const [problems, setProblems] = useState<string[]>([])

  if (!meso || !week || !plan || (mode === 'edit' && !day)) return <NotFound what="day" />
  const isLastWeek = weekIndex === meso.weeks.length - 1
  const back = mode === 'edit' && day ? paths.day(meso.id, week.id, day.id) : paths.meso(meso.id)

  function save() {
    if (!meso || !week || !plan) return
    const found = dayPlanProblems(plan)
    setProblems(found)
    if (found.length > 0) return

    if (mode === 'new') {
      store.update(meso.id, (m) => addDay(m, week.id, plan, scope))
      navigate(paths.meso(meso.id), { replace: true })
      return
    }
    if (!day) return
    const lost = loggedSetsLost(meso, week.id, day.id, plan, scope)
    if (lost > 0 && !window.confirm(`This removes ${lost} logged set${lost === 1 ? '' : 's'}. Save anyway?`)) return
    store.update(meso.id, (m) => applyDayPlan(m, week.id, day.id, plan, scope))
    navigate(back, { replace: true })
  }

  function remove() {
    if (!meso || !week || !day) return
    const where = scope === 'this' ? `from ${weekLabel(meso, weekIndex)}` : `from ${weekLabel(meso, weekIndex)} and every week after`
    if (!window.confirm(`Remove "${day.name}" ${where}? Any sets logged in it are deleted.`)) return
    store.update(meso.id, (m) => removeDay(m, week.id, day.id, scope))
    navigate(paths.meso(meso.id), { replace: true })
  }

  return (
    <Screen
      title={mode === 'new' ? 'Add a day' : `Edit ${day?.name ?? 'day'}`}
      subtitle={`${weekLabel(meso, weekIndex)} · ${meso.name}`}
      back={back}
      footer={
        <button className="btn btn-primary btn-block btn-large" onClick={save}>
          {mode === 'new' ? 'Add day' : 'Save changes'}
        </button>
      }
    >
      {!isLastWeek && (
        <section className="card">
          <div className="field">
            <span>Apply to</span>
            <Segmented
              label="Apply changes to"
              value={scope}
              options={[
                { value: 'this', label: `${weekLabel(meso, weekIndex)} only` },
                { value: 'remaining', label: 'This week and after' },
              ]}
              onChange={setScope}
            />
          </div>
          <p className="muted small">
            {scope === 'remaining'
              ? 'Later weeks find each exercise by name, so a renamed or swapped exercise starts fresh there (future weeks usually have nothing logged yet). Earlier weeks never change.'
              : 'Only this week changes. Later weeks keep their current plan.'}
          </p>
        </section>
      )}

      {problems.length > 0 && <ProblemList title="Fix these before saving:" items={problems} />}

      <DayPlanEditor value={plan} units={meso.units} onChange={setPlan} />

      {mode === 'edit' && week.days.length > 1 && (
        <button className="btn btn-danger-ghost btn-block" onClick={remove}>
          Remove this day
        </button>
      )}
    </Screen>
  )
}
