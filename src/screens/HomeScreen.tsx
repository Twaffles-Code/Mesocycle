import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dayProgress, setCounts, trainingWeekCount, upNext, weekLabel, weeksUntilDeload } from '../domain/meso'
import type { Meso } from '../domain/types'
import { isInstalledApp, preferences } from '../storage/persistence'
import { useMesoStore } from '../state/storeContext'
import { Badge, ProgressBar, Screen } from '../ui/components'
import { deloadText } from '../ui/deload'
import { paths } from '../ui/useRouteData'

const BACKUP_NUDGE_DAYS = 14

export function HomeScreen() {
  const { mesos } = useMesoStore()
  const current = mesos.find((m) => m.id === preferences.lastMesoId()) ?? mesos[0]

  return (
    <Screen
      title="Meso"
      actions={
        <Link to={paths.data()} className="icon-btn" aria-label="Data and backup">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      }
    >
      {current ? <UpNextCard meso={current} /> : <Welcome />}
      <BackupNudge mesos={mesos} />

      {mesos.length > 0 && (
        <section>
          <h2 className="section-title">Your mesos</h2>
          <ul className="list">
            {mesos.map((m) => (
              <li key={m.id}>
                <MesoRow meso={m} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link to={paths.newMeso()} className="btn btn-primary btn-block">
        + New meso
      </Link>
    </Screen>
  )
}

function Welcome() {
  return (
    <section className="card hero">
      <h2>Plan a meso, log every set.</h2>
      <p className="muted">
        Build your first mesocycle in the app or import a config file. It starts with 4 training weeks and a deload, and you can add weeks as you go.
      </p>
      {!isInstalledApp() && (
        <p className="muted small">
          On iPhone, tap Share → <strong>Add to Home Screen</strong> before you start. The installed app works offline and keeps its own storage, separate from this
          Safari tab.
        </p>
      )}
    </section>
  )
}

function UpNextCard({ meso }: { meso: Meso }) {
  const next = upNext(meso)
  if (!next) {
    return (
      <section className="card hero">
        <p className="eyebrow">{meso.name}</p>
        <h2>Meso complete</h2>
        <p className="muted">Every week is finished. Start the next meso from this one to keep your exercises.</p>
        <Link to={paths.meso(meso.id)} className="btn btn-block">
          Open {meso.name}
        </Link>
      </section>
    )
  }
  const week = meso.weeks[next.weekIndex]!
  const day = week.days[next.dayIndex]!
  const { done, total } = setCounts(day)
  const started = dayProgress(day) === 'in-progress'
  const until = weeksUntilDeload(meso, next.weekIndex)

  return (
    <section className="card hero">
      <p className="eyebrow">
        <Link to={paths.meso(meso.id)}>{meso.name}</Link>
      </p>
      <h2>
        {weekLabel(meso, next.weekIndex)} · {day.name}
      </h2>
      <div className="row gap">
        {week.isDeload ? <Badge tone="deload">Deload week</Badge> : until !== null && <Badge tone="muted">{deloadText(until)}</Badge>}
        <span className="muted small">
          {day.exercises.length} exercises · {total} sets
        </span>
      </div>
      {started && <ProgressBar done={done} total={total} />}
      <Link to={paths.day(meso.id, week.id, day.id)} className="btn btn-primary btn-block btn-large">
        {started ? 'Continue workout' : 'Start workout'}
      </Link>
    </section>
  )
}

function MesoRow({ meso }: { meso: Meso }) {
  const days = meso.weeks.flatMap((w) => w.days)
  const finished = days.filter((d) => dayProgress(d) === 'done' || dayProgress(d) === 'skipped').length
  return (
    <Link to={paths.meso(meso.id)} className="list-row">
      <div>
        <strong>{meso.name}</strong>
        <span className="muted small">
          {trainingWeekCount(meso)} weeks + deload · {finished}/{days.length} days
        </span>
      </div>
      <span className="chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}

function BackupNudge({ mesos }: { mesos: Meso[] }) {
  // Read the clock once when the screen opens, not on every re-render.
  const [now] = useState(() => Date.now())
  const hasLogs = mesos.some((m) => m.weeks.some((w) => w.days.some((d) => d.exercises.some((e) => e.sets.some((s) => s.status === 'done')))))
  if (!hasLogs) return null
  const last = preferences.lastBackupAt()
  const daysSince = last ? (now - Date.parse(last)) / 86_400_000 : Infinity
  if (daysSince < BACKUP_NUDGE_DAYS) return null
  return (
    <Link to={paths.data()} className="banner banner-warn">
      <span>{last ? `Last backup was ${Math.floor(daysSince)} days ago.` : "You haven't backed up yet."} Your workouts live only on this phone.</span>
      <span className="chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}
