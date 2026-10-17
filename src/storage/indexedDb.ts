// MesoRepository backed by IndexedDB: a real database built into every
// browser. It lives on the phone, works with no internet, and survives closing
// the app. Each meso is stored as one record holding its whole tree of weeks,
// days, exercises and sets — a "document" — because you always load and save
// a meso as a unit, and a few hundred sets is tiny.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Meso } from '../domain/types'
import { byMostRecent, type MesoRepository } from './repository'

const DB_NAME = 'meso-workout-log'
/** Bump this, and add a step to upgrade(), whenever the stored shape changes. */
const DB_VERSION = 1

interface WorkoutDb extends DBSchema {
  mesos: { key: string; value: Meso }
}

export function createIndexedDbRepository(dbName: string = DB_NAME): MesoRepository {
  let db: Promise<IDBPDatabase<WorkoutDb>> | undefined
  const open = () =>
    (db ??= openDB<WorkoutDb>(dbName, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) database.createObjectStore('mesos', { keyPath: 'id' })
      },
    }))

  return {
    async list() {
      return (await (await open()).getAll('mesos')).sort(byMostRecent)
    },
    async get(id) {
      return (await open()).get('mesos', id)
    },
    async save(meso) {
      await (await open()).put('mesos', meso)
    },
    async remove(id) {
      await (await open()).delete('mesos', id)
    },
  }
}
