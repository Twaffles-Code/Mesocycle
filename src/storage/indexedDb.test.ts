import 'fake-indexeddb/auto' // an in-memory IndexedDB, so this runs outside a browser
import { describe, expect, it } from 'vitest'
import { createMeso } from '../domain/meso'
import { plan } from '../domain/testFixtures'
import { createIndexedDbRepository } from './indexedDb'
import { restoreMesos } from './repository'

let dbCount = 0
const freshRepo = () => createIndexedDbRepository(`test-${++dbCount}`)

describe('IndexedDB repository', () => {
  it('saves, reads back, and deletes a meso', async () => {
    const repo = freshRepo()
    const meso = createMeso(plan)
    await repo.save(meso)
    expect(await repo.get(meso.id)).toEqual(meso)
    await repo.remove(meso.id)
    expect(await repo.get(meso.id)).toBeUndefined()
  })

  it('lists the most recently changed first', async () => {
    const repo = freshRepo()
    const older = createMeso(plan, new Date('2026-01-01'))
    const newer = createMeso({ ...plan, name: 'Newer' }, new Date('2026-03-01'))
    await repo.save(older)
    await repo.save(newer)
    expect((await repo.list()).map((m) => m.name)).toEqual(['Newer', 'Meso 5'])
  })

  it('save overwrites by id', async () => {
    const repo = freshRepo()
    const meso = createMeso(plan)
    await repo.save(meso)
    await repo.save({ ...meso, name: 'Renamed' })
    expect(await repo.list()).toHaveLength(1)
    expect((await repo.get(meso.id))?.name).toBe('Renamed')
  })

  it('restoring a backup replaces matching mesos and adds the rest', async () => {
    const repo = freshRepo()
    const kept = createMeso(plan)
    await repo.save(kept)
    const result = await restoreMesos(repo, [{ ...kept, name: 'From backup' }, createMeso({ ...plan, name: 'Other' })])
    expect(result).toEqual({ added: 1, replaced: 1 })
    expect((await repo.get(kept.id))?.name).toBe('From backup')
  })
})
