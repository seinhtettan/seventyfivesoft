import { z } from 'zod'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timestampSchema = z.string().min(1)
const identifierSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Identifiers may contain only letters, numbers, dots, underscores, colons, and hyphens.')
const entityIdentitySchema = z.string().min(1)
const nullableTimestampSchema = timestampSchema.nullable()

export const recordSchemas = {
  profile: z
    .object({
      id: z.literal(1),
      displayName: z.string(),
      age: z.number().int().nonnegative().nullable(),
      heightCm: z.number().positive().nullable(),
    })
    .strict(),
  preferences: z
    .object({
      id: z.literal(1),
      weightUnit: z.enum(['lb', 'kg']),
      timezone: z.string().min(1),
    })
    .strict(),
  challenge: z
    .object({
      id: identifierSchema,
      title: z.string().min(1),
      startDate: dateSchema,
      durationDays: z.number().int().min(1).max(3650),
      startWeightGrams: z.number().int().positive().nullable(),
      goalWeightGrams: z.number().int().positive().nullable(),
      status: z.enum(['draft', 'active', 'completed', 'archived']),
      createdAt: timestampSchema,
      deletedAt: nullableTimestampSchema,
    })
    .strict(),
  habit: z
    .object({
      id: identifierSchema,
      challengeId: identifierSchema,
      name: z.string().min(1),
      hint: z.string().nullable(),
      icon: z.string().min(1),
      cadence: z.enum(['daily', 'weekly']),
      weeklyTarget: z.number().int().positive().nullable(),
      weeklyBonus: z.number().int().positive().nullable(),
      sortOrder: z.number().int().nonnegative(),
      activeFrom: dateSchema,
      activeUntil: dateSchema.nullable(),
      createdAt: timestampSchema,
      deletedAt: nullableTimestampSchema,
    })
    .strict()
    .refine(({ activeFrom, activeUntil }) => activeUntil === null || activeUntil >= activeFrom, {
      path: ['activeUntil'],
      message: 'Active-until date must not be before active-from date.',
    }),
  habitMetric: z
    .object({
      id: identifierSchema,
      challengeId: identifierSchema,
      habitId: identifierSchema,
      label: z.string().min(1),
      unit: z.string().min(1),
      target: z.number().nullable(),
      step: z.number().positive(),
      minimum: z.number(),
      maximum: z.number(),
      sortOrder: z.number().int().nonnegative(),
      createdAt: timestampSchema,
      deletedAt: nullableTimestampSchema,
    })
    .strict()
    .refine(({ minimum, maximum }) => maximum >= minimum, {
      path: ['maximum'],
      message: 'Maximum must be greater than or equal to minimum.',
    }),
  habitEntry: z
    .object({
      challengeId: identifierSchema,
      habitId: identifierSchema,
      entryDate: dateSchema,
      completed: z.boolean(),
      deletedAt: nullableTimestampSchema,
    })
    .strict(),
  metricEntry: z
    .object({
      challengeId: identifierSchema,
      metricId: identifierSchema,
      entryDate: dateSchema,
      value: z.number(),
      deletedAt: nullableTimestampSchema,
    })
    .strict(),
  journal: z
    .object({
      challengeId: identifierSchema,
      entryDate: dateSchema,
      win: z.string(),
      gratitude: z.string(),
      feeling: z.string(),
      notes: z.string(),
      deletedAt: nullableTimestampSchema,
    })
    .strict(),
  weeklyReflection: z
    .object({
      challengeId: identifierSchema,
      weekIndex: z.number().int().nonnegative(),
      energy: z.number().int().min(1).max(5).nullable(),
      mood: z.number().int().min(1).max(5).nullable(),
      win: z.string(),
      intention: z.string(),
      deletedAt: nullableTimestampSchema,
    })
    .strict(),
  checkIn: z
    .object({
      id: identifierSchema,
      challengeId: identifierSchema,
      entryDate: dateSchema,
      weightGrams: z.number().int().positive().nullable(),
      mood: z.number().int().min(1).max(5).nullable(),
      energy: z.number().int().min(1).max(5).nullable(),
      notes: z.string().nullable(),
      createdAt: timestampSchema,
      deletedAt: nullableTimestampSchema,
    })
    .strict(),
} as const

export const entityTypeSchema = z.enum([
  'profile',
  'preferences',
  'challenge',
  'habit',
  'habitMetric',
  'habitEntry',
  'metricEntry',
  'journal',
  'weeklyReflection',
  'checkIn',
])

export type EntityType = z.infer<typeof entityTypeSchema>
export type SyncRecord = Record<string, unknown>

export interface SyncMutation {
  id: string
  deviceId: string
  entityType: EntityType
  entityId: string
  baseVersion: number
  operation: 'upsert' | 'delete'
  record: SyncRecord
  createdAt: string
}

export interface VersionedRecord extends SyncRecord {
  version: number
  updatedAt: string
}

export interface SyncChange {
  sequence: number
  mutationId: string
  deviceId: string
  entityType: EntityType
  entityId: string
  recordVersion: number
  operation: SyncMutation['operation']
  record: VersionedRecord
  createdAt: string
}

export interface SyncConflict {
  mutationId: string
  entityType: EntityType
  entityId: string
  serverVersion: number
  serverRecord: VersionedRecord | null
}

export interface SyncRequest {
  deviceId: string
  cursor: number
  mutations: SyncMutation[]
}

export interface SyncResponse {
  acknowledged: string[]
  conflicts: SyncConflict[]
  changes: SyncChange[]
  cursor: number
}

const syncMutationEnvelopeSchema = z
  .object({
    id: identifierSchema,
    deviceId: identifierSchema,
    entityType: entityTypeSchema,
    entityId: entityIdentitySchema,
    baseVersion: z.number().int().nonnegative(),
    operation: z.enum(['upsert', 'delete']),
    record: z.record(z.string(), z.unknown()),
    createdAt: timestampSchema,
  })
  .strict()

const syncRequestEnvelopeSchema = z
  .object({
    deviceId: identifierSchema,
    cursor: z.number().int().nonnegative(),
    mutations: z.array(syncMutationEnvelopeSchema).max(1_000),
  })
  .strict()

export function parseSyncRequest(value: unknown): SyncRequest {
  const request = syncRequestEnvelopeSchema.parse(value)
  return {
    ...request,
    mutations: request.mutations.map((mutation) => ({
      ...mutation,
      record: parseRecord(mutation.entityType, mutation.record),
    })),
  }
}

const versionedRecordEnvelopeSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (record) => z.number().int().positive().safeParse(record.version).success,
    'Record version must be a positive integer.',
  )
  .refine(
    (record) => timestampSchema.safeParse(record.updatedAt).success,
    'Record updatedAt must be an ISO timestamp.',
  )

const syncChangeEnvelopeSchema = z
  .object({
    sequence: z.number().int().positive(),
    mutationId: identifierSchema,
    deviceId: identifierSchema,
    entityType: entityTypeSchema,
    entityId: entityIdentitySchema,
    recordVersion: z.number().int().positive(),
    operation: z.enum(['upsert', 'delete']),
    record: versionedRecordEnvelopeSchema,
    createdAt: timestampSchema,
  })
  .strict()
  .refine((change) => change.record.version === change.recordVersion, {
    path: ['record', 'version'],
    message: 'Record version must match recordVersion.',
  })

const syncConflictEnvelopeSchema = z
  .object({
    mutationId: identifierSchema,
    entityType: entityTypeSchema,
    entityId: entityIdentitySchema,
    serverVersion: z.number().int().nonnegative(),
    serverRecord: versionedRecordEnvelopeSchema.nullable(),
  })
  .strict()
  .refine(
    (conflict) =>
      conflict.serverRecord === null || conflict.serverRecord.version === conflict.serverVersion,
    {
      path: ['serverRecord', 'version'],
      message: 'Server record version must match serverVersion.',
    },
  )

const syncResponseEnvelopeSchema = z
  .object({
    acknowledged: z.array(identifierSchema),
    conflicts: z.array(syncConflictEnvelopeSchema),
    changes: z.array(syncChangeEnvelopeSchema),
    cursor: z.number().int().nonnegative(),
  })
  .strict()

function parseVersionedRecord(entityType: EntityType, value: Record<string, unknown>): VersionedRecord {
  const version = z.number().int().positive().parse(value.version)
  const updatedAt = timestampSchema.parse(value.updatedAt)
  const { version: _version, updatedAt: _updatedAt, ...domainRecord } = value
  return { ...parseRecord(entityType, domainRecord), version, updatedAt }
}

export function parseSyncResponse(value: unknown): SyncResponse {
  const response = syncResponseEnvelopeSchema.parse(value)
  return {
    ...response,
    conflicts: response.conflicts.map((conflict) => ({
      ...conflict,
      serverRecord:
        conflict.serverRecord === null
          ? null
          : parseVersionedRecord(conflict.entityType, conflict.serverRecord),
    })),
    changes: response.changes.map((change) => ({
      ...change,
      record: parseVersionedRecord(change.entityType, change.record),
    })),
  }
}

export function parseRecord(entityType: EntityType, value: unknown): SyncRecord {
  return recordSchemas[entityType].parse(value) as SyncRecord
}
