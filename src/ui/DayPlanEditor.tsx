// Edits one day's plan: its name, its exercises, and each exercise's sets
// (rep target, RIR target, optional weight). Used when building a new meso and
// when editing a day in an existing one.

import type { DayPlan, ExercisePlan, SetPlan, Units } from '../domain/types'
import { NumberInput } from './components'
import { blankExercise, DEFAULT_SET, EXERCISE_NAMES_LIST } from './planDrafts'

export function DayPlanEditor({ value, onChange, units, showName = true }: { value: DayPlan; onChange: (next: DayPlan) => void; units: Units; showName?: boolean }) {
  const setExercises = (exercises: ExercisePlan[]) => onChange({ ...value, exercises })
  const updateExercise = (i: number, ex: ExercisePlan) => setExercises(value.exercises.map((e, j) => (j === i ? ex : e)))
  const move = (i: number, by: -1 | 1) => {
    const next = [...value.exercises]
    const [item] = next.splice(i, 1)
    next.splice(i + by, 0, item!)
    setExercises(next)
  }

  return (
    <div className="plan-editor">
      {showName && (
        <label className="field">
          <span>Day name</span>
          <input value={value.name} placeholder="e.g. Upper 1" onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </label>
      )}

      {value.exercises.map((ex, i) => (
        <ExerciseEditor
          key={ex.id}
          index={i}
          value={ex}
          units={units}
          onChange={(next) => updateExercise(i, next)}
          onMoveUp={i > 0 ? () => move(i, -1) : undefined}
          onMoveDown={i < value.exercises.length - 1 ? () => move(i, 1) : undefined}
          onRemove={() => setExercises(value.exercises.filter((_, j) => j !== i))}
        />
      ))}

      <button className="btn btn-ghost btn-block" onClick={() => setExercises([...value.exercises, blankExercise()])}>
        + Add exercise
      </button>
    </div>
  )
}

function ExerciseEditor(props: {
  index: number
  value: ExercisePlan
  units: Units
  onChange: (next: ExercisePlan) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove: () => void
}) {
  const { value, onChange } = props
  const setSet = (i: number, patch: Partial<SetPlan>) => onChange({ ...value, sets: value.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const label = value.name.trim() || `Exercise ${props.index + 1}`

  return (
    <section className="card exercise-editor">
      <input
        className="exercise-name-input"
        value={value.name}
        placeholder={`Exercise ${props.index + 1} name`}
        aria-label={`Exercise ${props.index + 1} name`}
        list={EXERCISE_NAMES_LIST}
        autoCapitalize="words"
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />

      <div className="set-grid" role="table" aria-label={`${label} sets`}>
        <div className="set-grid-row set-grid-head" role="row">
          <span role="columnheader">Set</span>
          <span role="columnheader">Reps</span>
          <span role="columnheader">RIR</span>
          <span role="columnheader">Weight ({props.units})</span>
          <span />
        </div>
        {value.sets.map((s, i) => (
          <div className="set-grid-row" role="row" key={i}>
            <span className="set-num">{i + 1}</span>
            <input aria-label={`Set ${i + 1} rep target`} value={s.targetReps} placeholder="8-12" onChange={(e) => setSet(i, { targetReps: e.target.value })} />
            <input aria-label={`Set ${i + 1} RIR target`} value={s.targetRir} placeholder="1-2" onChange={(e) => setSet(i, { targetRir: e.target.value })} />
            <NumberInput aria-label={`Set ${i + 1} weight`} value={s.targetWeight} placeholder="opt." onValue={(n) => setSet(i, { targetWeight: n })} />
            <button className="icon-btn small" aria-label={`Remove set ${i + 1}`} disabled={value.sets.length <= 1} onClick={() => onChange({ ...value, sets: value.sets.filter((_, j) => j !== i) })}>
              −
            </button>
          </div>
        ))}
      </div>
      <div className="exercise-editor-tools">
        <button className="btn btn-small btn-ghost" onClick={() => onChange({ ...value, sets: [...value.sets, value.sets.at(-1) ?? DEFAULT_SET] })}>
          + Set
        </button>
        <span className="spacer" />
        <button className="icon-btn small" aria-label={`Move ${label} up`} disabled={!props.onMoveUp} onClick={props.onMoveUp}>
          ↑
        </button>
        <button className="icon-btn small" aria-label={`Move ${label} down`} disabled={!props.onMoveDown} onClick={props.onMoveDown}>
          ↓
        </button>
        <button className="icon-btn small danger" aria-label={`Remove ${label}`} onClick={props.onRemove}>
          ✕
        </button>
      </div>
    </section>
  )
}

/** The <datalist> that powers name suggestions in every exercise name box. */
export function ExerciseNameSuggestions({ names }: { names: string[] }) {
  return (
    <datalist id={EXERCISE_NAMES_LIST}>
      {names.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  )
}
