import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { configFromPlan } from '../domain/config'
import { addWeek, dayProgress, planFromMeso, removeWeek, renameMeso, setCounts, suggestNextName, trainingWeekCount, upNext, weekLabel, weeksUntilDeload } from '../domain/meso'
import type { Meso, Week } from '../domain/types'
import { preferences } from '../storage/persistence'
import { useMesoStore } from '../state/storeContext'
import { ActionMenu, Badge, NotFound, ProgressIcon, Screen } from '../ui/components'
import { deloadText } from '../ui/deload'
import { downloadJson, slug } from '../ui/files'
import { paths, useRouteData } from '../ui/useRouteData'

export function MesoScreen() {
  const { store, meso } = useRouteData()
  const navigate = useNavigate()
  useEffect(() => {
    if (meso) preferences.setLastMesoId(meso.id)
  }, [meso])
  if (!meso) return <NotFound what="meso" />

  const next = upNext(meso)
  const until = next ? weeksUntilDeload(meso, next.weekIndex) : null
  const loggedSets = meso.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.flatMap((e) => e.sets))).filter((s) => s.status === 'done').length

  const menu = [
    {
      label: 'Rename',
      onSelect: () => {
        const name = window.prompt('Meso name', meso.name)
        if (name !== null) store.update(meso.id, (m) => renameMeso(m, name))
      },
    },
    { label: 'Export as config file', onSelect: () => downloadJson(`${slug(meso.name)}-config.json`, configFromPlan(planFromMeso(meso))) },
    {
      label: 'Start next meso from this',
      onSelect: () => navigate(paths.newMeso(), { state: { plan: { ...planFromMeso(meso), name: suggestNextName(meso.name), trainingWeeks: 4 } } }),
    },
    {
      label: 'Delete meso',
      danger: true,
      onSelect: async () => {
        const warning = loggedSets > 0 ? `\n\nThis deletes ${loggedSets} logged sets from this phone. Export a backup first if you want to keep them.` : ''
        if (!window.confirm(`Delete "${meso.name}"?${warning}`)) return
        await store.remove(meso.id)
        navigate(paths.home(), { replace: true })
      },
    },
  ]

  return (
    <Screen
      title={meso.name}
      subtitle={`${trainingWeekCount(meso)} weeks + deload · ${meso.units}`}
      back={paths.home()}
      actions={<ActionMenu label="Meso actions" items={menu} />}
    >
      {until !== null && (
        <div className={`banner ${until === 0 ? 'banner-deload' : 'banner-info'}`}>
          <span>{deloadText(until)}</span>
        </div>
      )}

      {meso.weeks.map((week, weekIndex) => (
        <WeekCard key={week.id} meso={meso} week={week} weekIndex={weekIndex} isCurrent={next?.weekIndex === weekIndex} currentDayIndex={next?.weekIndex === weekIndex ? next.dayIndex : -1}>
          {/* The add-week button sits right before the deload, which is where new weeks go. */}
          {meso.weeks[weekIndex + 1]?.isDeload && (
            <button className="btn btn-ghost btn-block add-week" onClick={() => store.update(meso.id, addWeek)}>
              + Add week {trainingWeekCount(meso) + 1} before the deload
            </button>
          )}
        </WeekCard>
      ))}
    </Screen>
  )
}

function WeekCard(props: { meso: Meso; week: Week; weekIndex: number; isCurrent: boolean; currentDayIndex: number; children?: ReactNode }) {
  const { meso, week, weekIndex } = props
  const store = useMesoStore()
  const navigate = useNavigate()
  const label = weekLabel(meso, weekIndex)

  const menu = [
    { label: 'Add a day to this week', onSelect: () => navigate(paths.newDay(meso.id, week.id)) },
    ...(week.isDeload
      ? []
      : [
          {
            label: `Remove ${label}`,
            danger: true,
            onSelect: () => {
              const logged = week.days.reduce((n, d) => n + setCounts(d).done, 0)
              const warning = logged > 0 ? ` It has ${logged} logged sets, which will be deleted.` : ''
              if (window.confirm(`Remove ${label}?${warning}`)) store.update(meso.id, (m) => removeWeek(m, week.id))
            },
          },
        ]),
  ]

  return (
    <>
      <section className={`card week-card${week.isDeload ? ' week-deload' : ''}${props.isCurrent ? ' week-current' : ''}`}>
        <header className="week-head">
          <h2>{label}</h2>
          {week.isDeload && <Badge tone="deload">Recovery week</Badge>}
          {props.isCurrent && <Badge tone="accent">Now</Badge>}
          <span className="spacer" />
          <ActionMenu label={`${label} actions`} items={menu} />
        </header>
        <ul className="day-list">
          {week.days.map((day, dayIndex) => {
            const progress = dayProgress(day)
            const { done, total } = setCounts(day)
            return (
              <li key={day.id}>
                <Link to={paths.day(meso.id, week.id, day.id)} className={`day-row${dayIndex === props.currentDayIndex ? ' day-row-next' : ''}`}>
                  <ProgressIcon progress={progress} />
                  <span className="day-row-name">{day.name}</span>
                  <span className="muted small">
                    {progress === 'skipped' ? 'Skipped' : progress === 'not-started' ? `${day.exercises.length} ex` : `${done}/${total}`}
                  </span>
                  {day.notes && (
                    <span className="note-flag" title="Has notes" aria-label="Has notes">
                      ✎
                    </span>
                  )}
                  <span className="chevron" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
      {props.children}
    </>
  )
}
