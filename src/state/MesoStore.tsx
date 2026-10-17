// The app's memory. Loads every meso once at start-up, hands them to screens,
// and is the only place that writes to storage.
//
// Screens change data by calling update(id, change), where `change` is one of
// the pure functions from src/domain (logSet, addWeek, ...). The store applies
// it, shows the result immediately, then saves it in the background.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Meso } from '../domain/types'
import { byMostRecent, restoreMesos, type MesoRepository } from '../storage/repository'
import { MesoStoreContext, type MesoStore, type Status } from './storeContext'

export function MesoStoreProvider({ repository, children }: { repository: MesoRepository; children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [mesos, setMesos] = useState<Meso[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  // A ref always holds the latest list, so two quick changes in a row (tapping
  // "log set" twice) build on each other instead of the second overwriting the first.
  const latest = useRef<Meso[]>([])
  const commit = useCallback((next: Meso[]) => {
    latest.current = next
    setMesos(next)
  }, [])

  // Saves run one after another, in the order they were made.
  const queue = useRef<Promise<void>>(Promise.resolve())
  const persist = useCallback(
    (meso: Meso) => {
      queue.current = queue.current
        .then(() => repository.save(meso))
        .catch((e: unknown) => setSaveError(`Couldn't save "${meso.name}": ${(e as Error).message ?? e}`))
    },
    [repository],
  )

  useEffect(() => {
    repository
      .list()
      .then((loaded) => {
        commit(loaded)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [repository, commit])

  const update = useCallback<MesoStore['update']>(
    (id, change) => {
      const current = latest.current.find((m) => m.id === id)
      if (!current) return undefined
      let next: Meso
      try {
        next = change(current)
      } catch (e) {
        alert((e as Error).message)
        return undefined
      }
      commit(latest.current.map((m) => (m.id === id ? next : m)).sort(byMostRecent))
      persist(next)
      return next
    },
    [commit, persist],
  )

  const value = useMemo<MesoStore>(
    () => ({
      status,
      mesos,
      saveError,
      get: (id) => (id ? mesos.find((m) => m.id === id) : undefined),
      update,
      add(meso) {
        commit([meso, ...latest.current.filter((m) => m.id !== meso.id)])
        persist(meso)
      },
      async remove(id) {
        await queue.current
        await repository.remove(id)
        commit(latest.current.filter((m) => m.id !== id))
      },
      async restore(incoming) {
        await queue.current
        const result = await restoreMesos(repository, incoming)
        commit(await repository.list())
        return result
      },
      dismissSaveError: () => setSaveError(null),
    }),
    [status, mesos, saveError, update, commit, persist, repository],
  )

  return <MesoStoreContext.Provider value={value}>{children}</MesoStoreContext.Provider>
}
