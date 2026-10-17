// The one door between the app and wherever your workouts are kept.
//
// Screens never touch IndexedDB, a server, or a file directly — they only call
// these four methods. Today the door opens onto the browser's own database
// (indexedDb.ts). Later it could open onto a server, or onto native storage in
// an iPhone app, and not a single screen would need to change.

import type { Meso } from '../domain/types'

export interface MesoRepository {
  /** Every meso, most recently changed first. */
  list(): Promise<Meso[]>
  get(id: string): Promise<Meso | undefined>
  /** Insert or overwrite (matched by id). */
  save(meso: Meso): Promise<void>
  remove(id: string): Promise<void>
}

/** Put a backup's mesos into storage. Same id overwrites; new ids are added. */
export async function restoreMesos(repo: MesoRepository, mesos: Meso[]): Promise<{ added: number; replaced: number }> {
  const existing = new Set((await repo.list()).map((m) => m.id))
  let replaced = 0
  for (const meso of mesos) {
    if (existing.has(meso.id)) replaced++
    await repo.save(meso)
  }
  return { added: mesos.length - replaced, replaced }
}

export function byMostRecent(a: Meso, b: Meso): number {
  return b.updatedAt.localeCompare(a.updatedAt)
}
