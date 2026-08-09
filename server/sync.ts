import type Database from 'better-sqlite3'
import {
  parseRecord,
  type EntityType,
  type SyncChange,
  type SyncConflict,
  type SyncMutation,
  type SyncRecord,
  type SyncRequest,
  type SyncResponse,
  type VersionedRecord,
} from '../src/lib/sync'

export type { SyncMutation, SyncRequest, SyncResponse } from '../src/lib/sync'

type SqlValue = string | number | bigint | Buffer | null

interface Column {
  column: string
  toDatabase?: (value: unknown) => SqlValue
  fromDatabase?: (value: unknown) => unknown
}

interface EntitySpec {
  table: string
  keys: string[]
  columns: Record<string, Column>
  entityId: (record: SyncRecord) => string
  deletable: boolean
}

const booleanColumn = (column: string): Column => ({
  column,
  toDatabase: (value) => (value ? 1 : 0),
  fromDatabase: (value) => value === 1,
})
const column = (name: string): Column => ({ column: name })

const entitySpecs: Record<EntityType, EntitySpec> = {
  profile: {
    table: 'profile',
    keys: ['id'],
    columns: {
      id: column('id'),
      displayName: column('display_name'),
      age: column('age'),
      heightCm: column('height_cm'),
    },
    entityId: () => 'profile',
    deletable: false,
  },
  preferences: {
    table: 'preferences',
    keys: ['id'],
    columns: {
      id: column('id'),
      weightUnit: column('weight_unit'),
      timezone: column('timezone'),
    },
    entityId: () => 'preferences',
    deletable: false,
  },
  challenge: {
    table: 'challenges',
    keys: ['id'],
    columns: {
      id: column('id'),
      title: column('title'),
      startDate: column('start_date'),
      durationDays: column('duration_days'),
      startWeightGrams: column('start_weight_grams'),
      goalWeightGrams: column('goal_weight_grams'),
      status: column('status'),
      createdAt: column('created_at'),
      deletedAt: column('deleted_at'),
    },
    entityId: (record) => String(record.id),
    deletable: true,
  },
  habit: {
    table: 'habits',
    keys: ['id'],
    columns: {
      id: column('id'),
      challengeId: column('challenge_id'),
      name: column('name'),
      hint: column('hint'),
      icon: column('icon'),
      cadence: column('cadence'),
      weeklyTarget: column('weekly_target'),
      weeklyBonus: column('weekly_bonus'),
      sortOrder: column('sort_order'),
      activeFrom: column('active_from'),
      activeUntil: column('active_until'),
      createdAt: column('created_at'),
      deletedAt: column('deleted_at'),
    },
    entityId: (record) => String(record.id),
    deletable: true,
  },
  habitMetric: {
    table: 'habit_metrics',
    keys: ['id'],
    columns: {
      id: column('id'),
      challengeId: column('challenge_id'),
      habitId: column('habit_id'),
      label: column('label'),
      unit: column('unit'),
      target: column('target'),
      step: column('step'),
      minimum: column('minimum'),
      maximum: column('maximum'),
      sortOrder: column('sort_order'),
      createdAt: column('created_at'),
      deletedAt: column('deleted_at'),
    },
    entityId: (record) => String(record.id),
    deletable: true,
  },
  habitEntry: {
    table: 'habit_entries',
    keys: ['challengeId', 'habitId', 'entryDate'],
    columns: {
      challengeId: column('challenge_id'),
      habitId: column('habit_id'),
      entryDate: column('entry_date'),
      completed: booleanColumn('completed'),
      deletedAt: column('deleted_at'),
    },
    entityId: (record) => `${record.challengeId}/${record.habitId}/${record.entryDate}`,
    deletable: true,
  },
  metricEntry: {
    table: 'metric_entries',
    keys: ['challengeId', 'metricId', 'entryDate'],
    columns: {
      challengeId: column('challenge_id'),
      metricId: column('metric_id'),
      entryDate: column('entry_date'),
      value: column('value'),
      deletedAt: column('deleted_at'),
    },
    entityId: (record) => `${record.challengeId}/${record.metricId}/${record.entryDate}`,
    deletable: true,
  },
  journal: {
    table: 'journals',
    keys: ['challengeId', 'entryDate'],
    columns: {
      challengeId: column('challenge_id'),
      entryDate: column('entry_date'),
      win: column('win'),
      gratitude: column('gratitude'),
      feeling: column('feeling'),
      notes: column('notes'),
      deletedAt: column('deleted_at'),
    },
    entityId: (record) => `${record.challengeId}/${record.entryDate}`,
    deletable: true,
  },
  weeklyReflection: {
    table: 'weekly_reflections',
    keys: ['challengeId', 'weekIndex'],
    columns: {
      challengeId: column('challenge_id'),
      weekIndex: column('week_index'),
      energy: column('energy'),
      mood: column('mood'),
      win: column('win'),
      intention: column('intention'),
      deletedAt: column('deleted_at'),
    },
    entityId: (record) => `${record.challengeId}/${record.weekIndex}`,
    deletable: true,
  },
  checkIn: {
    table: 'check_ins',
    keys: ['id'],
    columns: {
      id: column('id'),
      challengeId: column('challenge_id'),
      entryDate: column('entry_date'),
      weightGrams: column('weight_grams'),
      mood: column('mood'),
      energy: column('energy'),
      notes: column('notes'),
      createdAt: column('created_at'),
      deletedAt: column('deleted_at'),
    },
    entityId: (record) => String(record.id),
    deletable: true,
  },
}

const mutationPriority: Record<EntityType, number> = {
  profile: 0,
  preferences: 0,
  challenge: 1,
  habit: 2,
  habitMetric: 3,
  habitEntry: 4,
  metricEntry: 4,
  journal: 4,
  weeklyReflection: 4,
  checkIn: 4,
}

interface ChangeRow {
  sequence: number
  mutation_id: string
  device_id: string
  entity_type: EntityType
  entity_id: string
  base_version: number
  record_version: number
  operation: SyncMutation['operation']
  payload: string
  created_at: string
  client_created_at: string | null
}

export class SyncProtocolError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 422) {
    super(message)
    this.name = 'SyncProtocolError'
    this.code = code
    this.status = status
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function isExactReplay(row: ChangeRow, mutation: SyncMutation, parsedRecord: SyncRecord): boolean {
  const authoritative = JSON.parse(row.payload) as SyncRecord
  delete authoritative.version
  delete authoritative.updatedAt
  if (row.operation === 'delete' && Object.hasOwn(authoritative, 'deletedAt')) {
    authoritative.deletedAt = null
  }
  return (
    row.device_id === mutation.deviceId &&
    row.entity_type === mutation.entityType &&
    row.entity_id === mutation.entityId &&
    row.base_version === mutation.baseVersion &&
    row.operation === mutation.operation &&
    (row.client_created_at === null || row.client_created_at === mutation.createdAt) &&
    canonicalJson(authoritative) === canonicalJson(parsedRecord)
  )
}

function databaseValue(columnSpec: Column, value: unknown): SqlValue {
  if (columnSpec.toDatabase !== undefined) return columnSpec.toDatabase(value)
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    Buffer.isBuffer(value)
  ) {
    return value
  }
  throw new Error('Record contains a value that SQLite cannot store.')
}

function readRecord(
  database: Database.Database,
  entityType: EntityType,
  record: SyncRecord,
): VersionedRecord | null {
  const spec = entitySpecs[entityType]
  const where = spec.keys.map((field) => `${spec.columns[field]!.column} = ?`).join(' AND ')
  const values = spec.keys.map((field) => databaseValue(spec.columns[field]!, record[field]))
  const row = database
    .prepare<SqlValue[], Record<string, unknown>>(`SELECT * FROM ${spec.table} WHERE ${where}`)
    .get(...values)
  if (row === undefined) return null

  const parsed: SyncRecord = {}
  for (const [field, columnSpec] of Object.entries(spec.columns)) {
    const value = row[columnSpec.column]
    parsed[field] = columnSpec.fromDatabase?.(value) ?? value
  }
  return {
    ...parseRecord(entityType, parsed),
    version: Number(row.version),
    updatedAt: String(row.updated_at),
  }
}

function applyRecord(
  database: Database.Database,
  mutation: SyncMutation,
  parsedRecord: SyncRecord,
  recordVersion: number,
  updatedAt: string,
): VersionedRecord {
  const spec = entitySpecs[mutation.entityType]
  const record =
    mutation.operation === 'delete'
      ? (() => {
          if (!spec.deletable) {
            throw new SyncProtocolError(
              'entity_not_deletable',
              `${mutation.entityType} records cannot be deleted.`,
            )
          }
          return parseRecord(mutation.entityType, { ...parsedRecord, deletedAt: updatedAt })
        })()
      : parsedRecord
  const entries = Object.entries(spec.columns)
  const columns = entries.map(([, columnSpec]) => columnSpec.column)
  const values = entries.map(([field, columnSpec]) => databaseValue(columnSpec, record[field]))
  const conflictColumns = spec.keys.map((field) => spec.columns[field]!.column)
  const updates = columns
    .filter((name) => !conflictColumns.includes(name))
    .map((name) => `${name} = excluded.${name}`)
  updates.push('version = excluded.version', 'updated_at = excluded.updated_at')

  database
    .prepare(
      `INSERT INTO ${spec.table} (${columns.join(', ')}, version, updated_at)
       VALUES (${[...columns, 'version', 'updated_at'].map(() => '?').join(', ')})
       ON CONFLICT(${conflictColumns.join(', ')}) DO UPDATE SET ${updates.join(', ')}`,
    )
    .run(...values, recordVersion, updatedAt)

  const applied = readRecord(database, mutation.entityType, record)
  if (applied === null) throw new Error(`${mutation.entityType} mutation did not produce a record.`)
  return applied
}

function changeFromRow(row: ChangeRow): SyncChange {
  return {
    sequence: row.sequence,
    mutationId: row.mutation_id,
    deviceId: row.device_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    recordVersion: row.record_version,
    operation: row.operation,
    record: JSON.parse(row.payload) as VersionedRecord,
    createdAt: row.created_at,
  }
}

export function synchronize(database: Database.Database, request: SyncRequest): SyncResponse {
  return database.transaction(() => {
    const acknowledged: string[] = []
    const conflicts: SyncConflict[] = []
    const now = new Date().toISOString()
    const maximumCursor = Number(
      database.prepare('SELECT COALESCE(MAX(sequence), 0) FROM sync_changes').pluck().get(),
    )
    const pullCursor = request.cursor > maximumCursor ? 0 : request.cursor

    database
      .prepare(
        `INSERT INTO sync_devices (device_id, last_seen_at, last_cursor)
         VALUES (?, ?, ?)
         ON CONFLICT(device_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
      )
      .run(request.deviceId, now, pullCursor)

    const orderedMutations = request.mutations
      .map((mutation, requestIndex) => ({ mutation, requestIndex }))
      .sort(
        (left, right) =>
          mutationPriority[left.mutation.entityType] - mutationPriority[right.mutation.entityType] ||
          left.requestIndex - right.requestIndex,
      )
      .map(({ mutation }) => mutation)

    for (const mutation of orderedMutations) {
      if (mutation.deviceId !== request.deviceId) {
        throw new SyncProtocolError(
          'mutation_device_mismatch',
          'Mutation device does not match request device.',
        )
      }
      const parsedRecord = parseRecord(mutation.entityType, mutation.record)
      if (Object.hasOwn(parsedRecord, 'deletedAt') && parsedRecord.deletedAt !== null) {
        throw new SyncProtocolError(
          'client_tombstone_rejected',
          'Mutation records must send deletedAt as null; deletion timestamps are assigned by the server.',
        )
      }
      const prior = database
        .prepare<[string], ChangeRow>('SELECT * FROM sync_changes WHERE mutation_id = ?')
        .get(mutation.id)
      if (prior !== undefined) {
        if (!isExactReplay(prior, mutation, parsedRecord)) {
          throw new SyncProtocolError(
            'mutation_id_reused',
            'Mutation ID was reused for a different mutation.',
            409,
          )
        }
        acknowledged.push(mutation.id)
        continue
      }

      const expectedEntityId = entitySpecs[mutation.entityType].entityId(parsedRecord)
      if (mutation.entityId !== expectedEntityId) {
        throw new SyncProtocolError(
          'mutation_identity_mismatch',
          'Mutation identity does not match its record.',
        )
      }
      const current = readRecord(database, mutation.entityType, parsedRecord)
      const currentVersion = current?.version ?? 0
      if (currentVersion !== mutation.baseVersion) {
        conflicts.push({
          mutationId: mutation.id,
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          serverVersion: currentVersion,
          serverRecord: current,
        })
        continue
      }

      const recordVersion = currentVersion + 1
      const record = applyRecord(database, mutation, parsedRecord, recordVersion, now)
      database
        .prepare(
          `INSERT INTO sync_changes (
            mutation_id, device_id, entity_type, entity_id, base_version,
            record_version, operation, changed_fields, payload, created_at, client_created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          mutation.id,
          mutation.deviceId,
          mutation.entityType,
          mutation.entityId,
          mutation.baseVersion,
          recordVersion,
          mutation.operation,
          JSON.stringify(Object.keys(parsedRecord)),
          JSON.stringify(record),
          now,
          mutation.createdAt,
        )
      acknowledged.push(mutation.id)
    }

    const changes = database
      .prepare<[number], ChangeRow>('SELECT * FROM sync_changes WHERE sequence > ? ORDER BY sequence')
      .all(pullCursor)
      .map(changeFromRow)
    const cursor = changes.at(-1)?.sequence ?? pullCursor
    database
      .prepare('UPDATE sync_devices SET last_seen_at = ?, last_cursor = ? WHERE device_id = ?')
      .run(now, cursor, request.deviceId)

    return { acknowledged, conflicts, changes, cursor }
  })()
}
