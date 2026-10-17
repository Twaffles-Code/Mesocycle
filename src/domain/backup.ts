// A backup is everything: every meso with every logged set. Unlike a config
// file (structure only), restoring a backup brings your history back.

import { z } from 'zod'
import type { ParseResult } from './config'
import type { Meso } from './types'

export const BACKUP_APP_ID = 'meso-workout-log'

const setSchema = z.object({
  id: z.string(),
  targetReps: z.string(),
  targetRir: z.string(),
  targetWeight: z.number().nullable(),
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  rir: z.number().nullable(),
  status: z.enum(['pending', 'done', 'skipped']),
})

const mesoSchema = z.object({
  id: z.string(),
  name: z.string(),
  units: z.enum(['lb', 'kg']),
  createdAt: z.string(),
  updatedAt: z.string(),
  weeks: z.array(
    z.object({
      id: z.string(),
      isDeload: z.boolean(),
      days: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          notes: z.string(),
          skipped: z.boolean(),
          exercises: z.array(z.object({ id: z.string(), name: z.string(), skipped: z.boolean(), sets: z.array(setSchema) })),
        }),
      ),
    }),
  ),
}) satisfies z.ZodType<Meso>

const backupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  version: z.literal(1),
  exportedAt: z.string(),
  mesos: z.array(mesoSchema),
})

export type Backup = z.infer<typeof backupSchema>

export function makeBackup(mesos: Meso[], now: Date = new Date()): Backup {
  return { app: BACKUP_APP_ID, version: 1, exportedAt: now.toISOString(), mesos }
}

export function parseBackup(text: string): ParseResult<Meso[]> {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }
  if (typeof json === 'object' && json !== null && 'days' in json) {
    return { ok: false, errors: ['This looks like a meso config file, not a backup. Use "Import config" instead.'] }
  }
  const result = backupSchema.safeParse(json)
  if (!result.success) {
    return { ok: false, errors: result.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || 'file'}: ${i.message}`) }
  }
  return { ok: true, value: result.data.mesos }
}
