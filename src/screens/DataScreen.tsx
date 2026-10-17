import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeBackup, parseBackup } from '../domain/backup'
import { parseConfig } from '../domain/config'
import { EXAMPLE_CONFIG } from '../domain/exampleConfig'
import { isInstalledApp, preferences, requestPersistentStorage, type PersistenceState } from '../storage/persistence'
import { useMesoStore } from '../state/storeContext'
import { ProblemList, Screen } from '../ui/components'
import { downloadJson, today } from '../ui/files'
import { paths } from '../ui/useRouteData'

export function DataScreen() {
  const store = useMesoStore()
  const navigate = useNavigate()
  const [persistence, setPersistence] = useState<PersistenceState | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const backupInput = useRef<HTMLInputElement>(null)
  const configInput = useRef<HTMLInputElement>(null)
  const installed = isInstalledApp()
  const lastBackup = preferences.lastBackupAt()
  const loggedSets = store.mesos.flatMap((m) => m.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.flatMap((e) => e.sets)))).filter((s) => s.status === 'done').length

  useEffect(() => {
    void requestPersistentStorage().then(setPersistence)
  }, [])

  function exportBackup() {
    setErrors([])
    downloadJson(`meso-backup-${today()}.json`, makeBackup(store.mesos))
    preferences.setLastBackupAt(new Date().toISOString())
    setMessage('Backup saved. Keep it somewhere other than this phone — iCloud Drive, Google Drive, or email it to yourself.')
  }

  async function restoreBackup(file: File | undefined) {
    if (!file) return
    setErrors([])
    setMessage(null)
    const result = parseBackup(await file.text())
    if (!result.ok) return setErrors(result.errors)
    if (!window.confirm(`Restore ${result.value.length} meso(s)? Mesos already on this phone with the same id will be overwritten by the backup's version.`)) return
    const { added, replaced } = await store.restore(result.value)
    setMessage(`Restored: ${added} added, ${replaced} replaced.`)
  }

  async function importConfig(file: File | undefined) {
    if (!file) return
    setErrors([])
    setMessage(null)
    const result = parseConfig(await file.text())
    if (!result.ok) return setErrors(result.errors)
    navigate(paths.newMeso(), { state: { plan: result.value } })
  }

  return (
    <Screen title="Data & backup" back={paths.home()}>
      {message && (
        <div className="banner banner-success" role="status">
          <span>{message}</span>
        </div>
      )}
      {errors.length > 0 && <ProblemList title="Couldn't use that file:" items={errors} />}

      <section className="card">
        <h2 className="card-title">Where your workouts are</h2>
        <p>
          On <strong>this phone only</strong>, in this browser's built-in database. Nothing is sent anywhere. There's no account, so there's nothing to log in to — and
          nothing on a server to recover from if the phone is lost.
        </p>
        <dl className="facts">
          <dt>Mesos</dt>
          <dd>{store.mesos.length}</dd>
          <dt>Logged sets</dt>
          <dd>{loggedSets}</dd>
          <dt>Protected from clean-up</dt>
          <dd>{persistence === null ? '…' : persistence === 'persisted' ? 'Yes' : 'Not granted'}</dd>
          <dt>Installed to Home Screen</dt>
          <dd>{installed ? 'Yes' : 'No'}</dd>
        </dl>
        {!installed && (
          <p className="muted small">
            On iPhone: Share → <strong>Add to Home Screen</strong>. It then opens full-screen, works offline, and Safari won't clear its data after a week away. The
            Home Screen app keeps its <strong>own</strong> storage, separate from Safari — so if you've already logged workouts here, save a backup first and restore it
            in the installed app.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Backup</h2>
        <p className="muted small">A backup holds every meso and every logged set. {lastBackup ? `Last backup: ${new Date(lastBackup).toLocaleDateString()}.` : 'No backup yet.'}</p>
        <button className="btn btn-primary btn-block" onClick={exportBackup} disabled={store.mesos.length === 0}>
          Save a backup file
        </button>
        <button className="btn btn-block" onClick={() => backupInput.current?.click()}>
          Restore from a backup…
        </button>
        <input
          ref={backupInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void restoreBackup(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </section>

      <section className="card">
        <h2 className="card-title">Config files</h2>
        <p className="muted small">A config file describes a meso's days, exercises and set targets — no results. Write one by hand, or export one from any meso's menu.</p>
        <button className="btn btn-block" onClick={() => configInput.current?.click()}>
          Import a config file…
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => downloadJson('meso-config-example.json', EXAMPLE_CONFIG)}>
          Download an example config
        </button>
        <input
          ref={configInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void importConfig(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </section>
    </Screen>
  )
}
