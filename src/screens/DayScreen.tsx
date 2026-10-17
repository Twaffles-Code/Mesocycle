import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { setDayNotes, setDaySkipped, setExerciseSkipped, nextExercise } from '../domain/logging'
import { dayProgress, exerciseProgress, setCounts, upNext, weekLabel } from '../domain/meso'
import { Badge, NotFound, ProgressBar, Screen, SetDots } from '../ui/components'
import { exerciseTarget } from '../ui/format'
import { paths, useRouteData } from '../ui/useRouteData'

export function DayScreen() {
  const { store, meso, week, weekIndex, day } = useRouteData()
  if (!meso || !week || !day) return <NotFound what="day" />

  const progress = dayProgress(day)
  const { done, total } = setCounts(day)
  const suggested = progress === 'skipped' ? null : nextExercise(day)
  const following = upNext(meso)
  const followingDay = following ? meso.weeks[following.weekIndex]!.days[following.dayIndex]! : null

  return (
    <Screen
      title={day.name}
      subtitle={`${weekLabel(meso, weekIndex)} · ${meso.name}`}
      back={paths.meso(meso.id)}
      footer={
        <div className="footer-split">
          <button className="btn" onClick={() => store.update(meso.id, (m) => setDaySkipped(m, week.id, day.id, !day.skipped))}>
            {day.skipped ? 'Unskip day' : 'Skip day'}
          </button>
          <Link className="btn" to={paths.editDay(meso.id, week.id, day.id)}>
            Edit day
          </Link>
        </div>
      }
    >
      {week.isDeload && (
        <div className="banner banner-deload">
          <span>Deload week — train for recovery. Adjust sets and loads however you run your deloads.</span>
        </div>
      )}

      {progress === 'skipped' ? (
        <div className="banner banner-info">
          <span>You skipped this day. Logging any set un-skips it.</span>
        </div>
      ) : (
        <div className="day-progress">
          <ProgressBar done={done} total={total} />
          <span className="muted small">
            {done} of {total} sets
          </span>
        </div>
      )}

      {progress === 'done' && (
        <section className="card hero">
          <h2>Day complete</h2>
          {followingDay && following && (
            <Link className="btn btn-primary btn-block" to={paths.day(meso.id, meso.weeks[following.weekIndex]!.id, followingDay.id)}>
              Next: {weekLabel(meso, following.weekIndex)} · {followingDay.name}
            </Link>
          )}
        </section>
      )}

      <ul className="exercise-list">
        {day.exercises.map((ex) => {
          const exProgress = exerciseProgress(ex)
          const isNext = suggested?.id === ex.id
          return (
            <li key={ex.id} className={`card exercise-card exercise-${exProgress}${isNext ? ' exercise-next' : ''}`}>
              <Link to={paths.exercise(meso.id, week.id, day.id, ex.id)} className="exercise-card-main">
                <div className="row gap">
                  <strong className="exercise-name">{ex.name}</strong>
                  {isNext && <Badge tone="accent">Up next</Badge>}
                  {exProgress === 'skipped' && <Badge tone="muted">Skipped</Badge>}
                  {exProgress === 'done' && <Badge tone="success">Done</Badge>}
                </div>
                <span className="muted small">{exerciseTarget(ex.sets, meso.units)}</span>
                <SetDots sets={ex.sets} />
              </Link>
              <button
                className="btn btn-small btn-ghost exercise-skip"
                onClick={() => store.update(meso.id, (m) => setExerciseSkipped(m, week.id, day.id, ex.id, !ex.skipped))}
              >
                {ex.skipped ? 'Unskip' : 'Skip'}
              </button>
            </li>
          )
        })}
      </ul>

      <DayNotes key={day.id} initial={day.notes} onSave={(notes) => store.update(meso.id, (m) => setDayNotes(m, week.id, day.id, notes))} />
    </Screen>
  )
}

/**
 * Notes save a moment after you stop typing, when you leave the box, and when
 * you leave the screen — so locking your phone mid-sentence doesn't lose them.
 */
function DayNotes({ initial, onSave }: { initial: string; onSave: (notes: string) => void }) {
  const [text, setText] = useState(initial)
  const pending = useRef<{ text: string; saved: string; onSave: typeof onSave }>({ text: initial, saved: initial, onSave })
  // Keep the ref pointing at the latest text and save function, so a save fired
  // by the timer or on leaving the screen uses current values.
  useEffect(() => {
    pending.current.text = text
    pending.current.onSave = onSave
  })

  const flush = useCallback(() => {
    const p = pending.current
    if (p.text !== p.saved) {
      p.saved = p.text
      p.onSave(p.text)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(flush, 800)
    return () => clearTimeout(timer)
  }, [text, flush])
  useEffect(() => flush, [flush]) // on leaving the screen

  return (
    <label className="field card">
      <span>Day notes</span>
      <textarea
        rows={3}
        value={text}
        placeholder="How it felt, swaps, soreness, anything for next week…"
        onChange={(e) => setText(e.target.value)}
        onBlur={flush}
      />
    </label>
  )
}
