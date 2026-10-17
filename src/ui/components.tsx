// Small building blocks shared by every screen.

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Progress } from '../domain/meso'
import type { WorkoutSet } from '../domain/types'
import { useMesoStore } from '../state/storeContext'
import { parseNumber } from './format'

/**
 * A number box that keeps exactly what you typed. Storing only the parsed
 * number would turn "77." into "77" mid-keystroke, so you could never type 77.5.
 */
export function NumberInput({
  value,
  onValue,
  ...rest
}: { value: number | null; onValue: (n: number | null) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const show = (n: number | null) => (n === null ? '' : String(n))
  const [text, setText] = useState(show(value))
  const [seen, setSeen] = useState(value)
  // The value changed from outside (e.g. a different set was selected): show the new one.
  if (value !== seen) {
    setSeen(value)
    if (parseNumber(text) !== value) setText(show(value))
  }
  return (
    <input
      inputMode="decimal"
      {...rest}
      value={text}
      onChange={(e) => {
        const n = parseNumber(e.target.value)
        setText(e.target.value)
        setSeen(n)
        onValue(n)
      }}
    />
  )
}

export function Screen(props: {
  title: ReactNode
  subtitle?: ReactNode
  back?: string
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="screen">
      <header className="topbar">
        {props.back ? (
          <Link to={props.back} className="icon-btn" aria-label="Back">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <span className="icon-btn-spacer" />
        )}
        <div className="topbar-title">
          <h1>{props.title}</h1>
          {props.subtitle && <p>{props.subtitle}</p>}
        </div>
        <div className="topbar-actions">{props.actions ?? <span className="icon-btn-spacer" />}</div>
      </header>
      <SaveErrorBanner />
      <main className="content">{props.children}</main>
      {props.footer && <div className="footer-bar">{props.footer}</div>}
    </div>
  )
}

function SaveErrorBanner() {
  const { saveError, dismissSaveError } = useMesoStore()
  if (!saveError) return null
  return (
    <div className="banner banner-danger" role="alert">
      <span>{saveError}</span>
      <button className="btn btn-small" onClick={dismissSaveError}>
        OK
      </button>
    </div>
  )
}

export function NotFound({ what }: { what: string }) {
  return (
    <Screen title="Not found" back="/">
      <p className="muted">This {what} doesn't exist any more. It may have been deleted.</p>
      <Link className="btn" to="/">
        Go home
      </Link>
    </Screen>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'deload' | 'success' | 'muted'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

/** One dot per set: filled = logged, ring = to do, slash = skipped. */
export function SetDots({ sets, current }: { sets: WorkoutSet[]; current?: string }) {
  return (
    <span className="set-dots" aria-label={`${sets.filter((s) => s.status === 'done').length} of ${sets.length} sets logged`}>
      {sets.map((s) => (
        <span key={s.id} className={`dot dot-${s.status}${s.id === current ? ' dot-current' : ''}`} />
      ))}
    </span>
  )
}

const PROGRESS_LABEL: Record<Progress, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  done: 'Done',
  skipped: 'Skipped',
}

export function ProgressIcon({ progress }: { progress: Progress }) {
  return <span className={`progress-icon progress-${progress}`} aria-label={PROGRESS_LABEL[progress]} title={PROGRESS_LABEL[progress]} />
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}

/** A "⋯" button that opens a short list of actions. */
export function ActionMenu({ label = 'More actions', items }: { label?: string; items: { label: string; onSelect: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button className="icon-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="5" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="19" cy="12" r="2" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={item.danger ? 'menu-item danger' : 'menu-item'}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Two-or-more options, one selected. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A number with − and + buttons either side. */
export function Stepper({ value, onChange, min = 0, max = Infinity, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="stepper" aria-label={label}>
      <button aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output>{value}</output>
      <button aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}

/** A red box listing what needs fixing. */
export function ProblemList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="banner banner-danger banner-stack" role="alert">
      <strong>{title}</strong>
      <ul>
        {items.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  )
}
