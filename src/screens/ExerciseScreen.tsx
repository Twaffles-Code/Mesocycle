// The screen you use mid-workout: one exercise, one set at a time.
// Log a set (or skip it) and it moves you to the next one. When the exercise
// is finished it offers the next one in your usual order — or pick any.

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logSet, nextExercise, nextPendingSetIndex, previousPerformance, resetSet, setExerciseSkipped, skipSet, suggestedEntry, type SetRef } from '../domain/logging'
import { INTENSITY_LEVELS, intensityOf } from '../domain/intensity'
import { exerciseProgress, weekLabel } from '../domain/meso'
import type { Day, DayExercise, Meso, Units, Week } from '../domain/types'
import { Badge, NotFound, NumberInput, Screen } from '../ui/components'
import { num, performed, setTarget } from '../ui/format'
import { paths, useRouteData } from '../ui/useRouteData'

export function ExerciseScreen() {
  const { meso, week, weekIndex, day, exercise } = useRouteData()
  if (!meso || !week || !day || !exercise) return <NotFound what="exercise" />
  // key: switching exercise starts the screen afresh rather than reusing the last one's state.
  return <ExerciseLogger key={exercise.id} meso={meso} week={week} weekIndex={weekIndex} day={day} exercise={exercise} />
}

function ExerciseLogger({ meso, week, weekIndex, day, exercise }: { meso: Meso; week: Week; weekIndex: number; day: Day; exercise: DayExercise }) {
  const { store } = useRouteData()
  const navigate = useNavigate()
  const firstPending = nextPendingSetIndex(exercise)
  const [selectedId, setSelectedId] = useState(exercise.sets[firstPending === -1 ? 0 : firstPending]!.id)
  const [justFinished, setJustFinished] = useState(false)

  const selectedIndex = Math.max(0, exercise.sets.findIndex((s) => s.id === selectedId))
  const selected = exercise.sets[selectedIndex]!
  const ref: SetRef = { weekId: week.id, dayId: day.id, exerciseId: exercise.id, setId: selected.id }
  const progress = exerciseProgress(exercise)
  const after = nextExercise(day, exercise.id)

  /** Apply a change, then jump to the next set still to do — or show "exercise done". */
  function applyAndAdvance(change: (m: Meso) => Meso) {
    const updated = store.update(meso.id, change)
    const ex = updated?.weeks.find((w) => w.id === week.id)?.days.find((d) => d.id === day.id)?.exercises.find((e) => e.id === exercise.id)
    if (!ex) return
    const i = nextPendingSetIndex(ex)
    if (i === -1) setJustFinished(true)
    else setSelectedId(ex.sets[i]!.id)
  }

  const goTo = (ex: DayExercise) => navigate(paths.exercise(meso.id, week.id, day.id, ex.id), { replace: true })

  return (
    <Screen title={exercise.name} subtitle={`${weekLabel(meso, weekIndex)} · ${day.name}`} back={paths.day(meso.id, week.id, day.id)}>
      <ExerciseSwitcher day={day} currentId={exercise.id} onPick={goTo} />

      {exercise.skipped && (
        <div className="banner banner-info">
          <span>Skipped. Logging a set brings it back.</span>
        </div>
      )}

      {(justFinished || progress === 'done') && (
        <section className="card hero done-panel">
          <h2>{exercise.name} done</h2>
          {after ? (
            <button className="btn btn-primary btn-block btn-large" onClick={() => goTo(after)}>
              Next: {after.name}
            </button>
          ) : (
            <Link className="btn btn-primary btn-block btn-large" to={paths.day(meso.id, week.id, day.id)}>
              All exercises done — back to day
            </Link>
          )}
        </section>
      )}

      <div className="set-strip" role="tablist" aria-label="Sets">
        {exercise.sets.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === selected.id}
            className={`set-chip set-chip-${s.status}${s.id === selected.id ? ' active' : ''}`}
            onClick={() => {
              setSelectedId(s.id)
              setJustFinished(false)
            }}
          >
            <span className="set-chip-num">Set {i + 1}</span>
            <span className="set-chip-detail">{s.status === 'done' ? `${num(s.weight)}×${num(s.reps)}` : s.status === 'skipped' ? 'skipped' : s.targetReps}</span>
          </button>
        ))}
      </div>

      {/* key: picking a different set resets the boxes to that set's numbers. */}
      <SetForm
        key={selected.id}
        meso={meso}
        setRef={ref}
        index={selectedIndex}
        total={exercise.sets.length}
        units={meso.units}
        onLog={(entry) => applyAndAdvance((m) => logSet(m, ref, entry))}
        onSkip={() => applyAndAdvance((m) => skipSet(m, ref))}
        onReset={() => {
          store.update(meso.id, (m) => resetSet(m, ref))
          setJustFinished(false)
        }}
      />

      <button className="btn btn-ghost btn-block" onClick={() => store.update(meso.id, (m) => setExerciseSkipped(m, week.id, day.id, exercise.id, !exercise.skipped))}>
        {exercise.skipped ? 'Unskip exercise' : 'Skip this exercise'}
      </button>
    </Screen>
  )
}

/** Every exercise in the day as a row of chips, so you can jump to any of them. */
function ExerciseSwitcher({ day, currentId, onPick }: { day: Day; currentId: string; onPick: (ex: DayExercise) => void }) {
  const active = useRef<HTMLButtonElement>(null)
  // Exercises further down the day sit off-screen to the right; bring the current one into view.
  useEffect(() => active.current?.scrollIntoView({ block: 'nearest', inline: 'center' }), [currentId])
  return (
    <nav className="switcher" aria-label="Exercises in this day">
      {day.exercises.map((ex) => (
        <button
          key={ex.id}
          ref={ex.id === currentId ? active : undefined}
          className={`switcher-chip switcher-${exerciseProgress(ex)}${ex.id === currentId ? ' active' : ''}`}
          aria-current={ex.id === currentId}
          onClick={() => onPick(ex)}
        >
          {ex.name}
        </button>
      ))}
    </nav>
  )
}

function SetForm(props: {
  meso: Meso
  setRef: SetRef
  index: number
  total: number
  units: Units
  onLog: (entry: { weight: number | null; reps: number | null; rir: number | null }) => void
  onSkip: () => void
  onReset: () => void
}) {
  const set = props.meso.weeks.find((w) => w.id === props.setRef.weekId)!.days.find((d) => d.id === props.setRef.dayId)!.exercises.find((e) => e.id === props.setRef.exerciseId)!.sets[props.index]!
  const [initial] = useState(() => suggestedEntry(props.meso, props.setRef))
  const [previous] = useState(() => previousPerformance(props.meso, props.setRef))
  const [weight, setWeight] = useState(initial.weight)
  const [reps, setReps] = useState(initial.reps)
  const [rir, setRir] = useState(initial.rir)
  const intensity = intensityOf(rir)
  const step = props.units === 'lb' ? 5 : 2.5
  const bump = (value: number | null, by: number, min = 0) => Math.max(min, Number(((value ?? 0) + by).toFixed(2)))

  return (
    <section className="card set-form">
      <div className="set-form-head">
        <h2>
          Set {props.index + 1} <span className="muted">of {props.total}</span>
        </h2>
        {set.status === 'done' && <Badge tone="success">Logged</Badge>}
        {set.status === 'skipped' && <Badge tone="muted">Skipped</Badge>}
      </div>
      <p className="target">Target: {setTarget(set, props.units)}</p>
      {previous && (
        <p className="muted small">
          {weekLabel(props.meso, previous.weekIndex)}: {performed(previous, props.units)}
        </p>
      )}

      <div className="big-field">
        <span>Weight ({props.units})</span>
        <div className="big-input">
          <button aria-label={`Weight minus ${step}`} onClick={() => setWeight(bump(weight, -step))}>
            −
          </button>
          <NumberInput aria-label="Weight" value={weight} placeholder="BW" onValue={setWeight} />
          <button aria-label={`Weight plus ${step}`} onClick={() => setWeight(bump(weight, step))}>
            +
          </button>
        </div>
      </div>

      <div className="big-field">
        <span>Reps</span>
        <div className="big-input">
          <button aria-label="One fewer rep" onClick={() => setReps(bump(reps, -1))}>
            −
          </button>
          <NumberInput aria-label="Reps" inputMode="numeric" value={reps} placeholder={set.targetReps} onValue={setReps} />
          <button aria-label="One more rep" onClick={() => setReps(bump(reps, 1))}>
            +
          </button>
        </div>
      </div>

      <div className="big-field">
        <span>Intensity</span>
        <div className="rir-chips" role="radiogroup" aria-label="Intensity">
          {INTENSITY_LEVELS.map((l) => (
            <button
              key={l.level}
              role="radio"
              aria-label={l.label}
              title={l.label}
              aria-checked={intensity === l.level}
              className={intensity === l.level ? 'active' : ''}
              onClick={() => setRir(intensity === l.level ? null : l.rir)}
            >
              {l.emoji}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-block" onClick={() => props.onLog({ weight, reps: null, rir })}>
        Didn't count reps
      </button>

      <div className="footer-split">
        {set.status === 'pending' ? (
          <button className="btn" onClick={props.onSkip}>
            Skip set
          </button>
        ) : (
          <button className="btn" onClick={props.onReset}>
            {set.status === 'skipped' ? 'Unskip' : 'Undo'}
          </button>
        )}
        <button className="btn btn-primary btn-large" disabled={reps === null} onClick={() => props.onLog({ weight, reps, rir })}>
          {set.status === 'done' ? 'Update set' : 'Log set'}
        </button>
      </div>
    </section>
  )
}
