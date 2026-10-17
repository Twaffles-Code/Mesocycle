import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { parseConfig } from '../domain/config'
import { EXAMPLE_CONFIG } from '../domain/exampleConfig'
import { createMeso, DEFAULT_TRAINING_WEEKS, planFromMeso, suggestNextName } from '../domain/meso'
import { MAX_DAYS, MAX_TRAINING_WEEKS } from '../domain/config'
import type { DayPlan, MesoPlan } from '../domain/types'
import { mesoPlanProblems } from '../domain/validation'
import { preferences } from '../storage/persistence'
import { useMesoStore } from '../state/storeContext'
import { ProblemList, Screen, Segmented, Stepper } from '../ui/components'
import { DayPlanEditor } from '../ui/DayPlanEditor'
import { blankExercise, withKeys } from '../ui/planDrafts'
import { paths } from '../ui/useRouteData'

const STARTING_DAYS = 5

function blankPlan(): MesoPlan {
  return {
    name: '',
    units: 'lb',
    trainingWeeks: DEFAULT_TRAINING_WEEKS,
    days: Array.from({ length: STARTING_DAYS }, (_, i) => ({ name: `Day ${i + 1}`, exercises: [blankExercise()] })),
  }
}

const keyed = (plan: MesoPlan): MesoPlan => ({ ...plan, days: plan.days.map(withKeys) })

/** Other screens can open this one pre-filled by passing { plan } as router state. */
export function NewMesoScreen() {
  const store = useMesoStore()
  const navigate = useNavigate()
  const incoming = (useLocation().state as { plan?: MesoPlan } | null)?.plan
  const [plan, setPlan] = useState<MesoPlan>(() => (incoming ? keyed(incoming) : blankPlan()))
  const [openDay, setOpenDay] = useState<number | null>(0)
  const [problems, setProblems] = useState<string[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const replacePlan = (next: MesoPlan) => {
    setPlan(keyed(next))
    setOpenDay(0)
    setProblems([])
    setImportErrors([])
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    const result = parseConfig(await file.text())
    if (result.ok) replacePlan(result.value)
    else setImportErrors(result.errors)
  }

  function copyFrom(mesoId: string) {
    const source = store.get(mesoId)
    if (source) replacePlan({ ...planFromMeso(source), name: suggestNextName(source.name), trainingWeeks: DEFAULT_TRAINING_WEEKS })
  }

  function create() {
    const found = mesoPlanProblems(plan)
    setProblems(found)
    if (found.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const meso = createMeso(plan)
    store.add(meso)
    preferences.setLastMesoId(meso.id)
    navigate(paths.meso(meso.id), { replace: true })
  }

  const setDay = (i: number, day: DayPlan) => setPlan({ ...plan, days: plan.days.map((d, j) => (j === i ? day : d)) })

  return (
    <Screen
      title="New meso"
      back={paths.home()}
      footer={
        <button className="btn btn-primary btn-block btn-large" onClick={create}>
          Create meso · {plan.trainingWeeks} weeks + deload
        </button>
      }
    >
      <section className="card">
        <h2 className="card-title">Start from</h2>
        <div className="chip-row">
          <button className="chip" onClick={() => replacePlan(blankPlan())}>
            Blank
          </button>
          <button className="chip" onClick={() => fileInput.current?.click()}>
            Config file…
          </button>
          <button
            className="chip"
            onClick={() => {
              const r = parseConfig(JSON.stringify(EXAMPLE_CONFIG))
              if (r.ok) replacePlan(r.value)
            }}
          >
            Example
          </button>
          {store.mesos.length > 0 && (
            <select className="chip" value="" aria-label="Copy a previous meso" onChange={(e) => copyFrom(e.target.value)}>
              <option value="" disabled>
                Copy a meso…
              </option>
              {store.mesos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void importFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {importErrors.length > 0 && <ProblemList title="That config file has problems:" items={importErrors} />}
      </section>

      {problems.length > 0 && <ProblemList title="Fix these before creating:" items={problems} />}

      <section className="card">
        <label className="field">
          <span>Meso name</span>
          <input value={plan.name} placeholder="e.g. Meso 5 - Mass 2" onChange={(e) => setPlan({ ...plan, name: e.target.value })} />
        </label>
        <div className="field-row">
          <div className="field">
            <span>Training weeks</span>
            <Stepper label="training weeks" value={plan.trainingWeeks} min={1} max={MAX_TRAINING_WEEKS} onChange={(n) => setPlan({ ...plan, trainingWeeks: n })} />
          </div>
          <div className="field">
            <span>Units</span>
            <Segmented
              label="Units"
              value={plan.units}
              options={[
                { value: 'lb', label: 'lb' },
                { value: 'kg', label: 'kg' },
              ]}
              onChange={(units) => setPlan({ ...plan, units })}
            />
          </div>
        </div>
        <p className="muted small">A deload week is added after the last training week. You can add more weeks later.</p>
      </section>

      <h2 className="section-title">Days ({plan.days.length})</h2>
      {plan.days.map((day, i) => (
        <section key={i} className="card day-plan">
          <button className="day-plan-toggle" aria-expanded={openDay === i} onClick={() => setOpenDay(openDay === i ? null : i)}>
            <span>
              <strong>{day.name.trim() || `Day ${i + 1}`}</strong>
              <span className="muted small">
                {' '}
                · {day.exercises.length} exercise{day.exercises.length === 1 ? '' : 's'}
              </span>
            </span>
            <span className="chevron" aria-hidden="true">
              {openDay === i ? '▾' : '▸'}
            </span>
          </button>
          {openDay === i && (
            <>
              <DayPlanEditor value={day} units={plan.units} onChange={(d) => setDay(i, d)} />
              {plan.days.length > 1 && (
                <button
                  className="btn btn-small btn-danger-ghost"
                  onClick={() => {
                    setPlan({ ...plan, days: plan.days.filter((_, j) => j !== i) })
                    setOpenDay(null)
                  }}
                >
                  Remove this day
                </button>
              )}
            </>
          )}
        </section>
      ))}
      {plan.days.length < MAX_DAYS && (
        <button
          className="btn btn-ghost btn-block"
          onClick={() => {
            setPlan({ ...plan, days: [...plan.days, { name: `Day ${plan.days.length + 1}`, exercises: [blankExercise()] }] })
            setOpenDay(plan.days.length)
          }}
        >
          + Add day
        </button>
      )}
    </Screen>
  )
}
