// What the store offers to screens, and the hook screens use to reach it.
// The implementation lives in MesoStore.tsx.

import { createContext, useContext } from 'react'
import type { Meso } from '../domain/types'

export type Status = 'loading' | 'ready' | 'error'

export interface MesoStore {
  status: Status
  mesos: Meso[]
  /** Set when a save failed. The change is on screen but not stored. */
  saveError: string | null
  get(id: string | undefined): Meso | undefined
  /** Apply a change to one meso and save it. Returns the new version (or undefined if the change threw). */
  update(id: string, change: (meso: Meso) => Meso): Meso | undefined
  add(meso: Meso): void
  remove(id: string): Promise<void>
  restore(mesos: Meso[]): Promise<{ added: number; replaced: number }>
  dismissSaveError(): void
}

export const MesoStoreContext = createContext<MesoStore | null>(null)

export function useMesoStore(): MesoStore {
  const store = useContext(MesoStoreContext)
  if (!store) throw new Error('useMesoStore must be used inside <MesoStoreProvider>')
  return store
}
