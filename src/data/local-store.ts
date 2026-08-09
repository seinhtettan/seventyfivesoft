import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SyncConflict, SyncMutation, SyncResponse, VersionedRecord } from '@/lib/sync'
import type { NormalizedEntity } from './normalize-state'

export interface StoredEntity extends NormalizedEntity {
  key: string
  version: number
  updatedAt: string | null
}

interface StoredMutation extends SyncMutation {
  entityKey: string
}

interface LocalDatabase extends DBSchema {
  entities: {
    key: string
    value: StoredEntity
    indexes: { byType: string }
  }
  outbox: {
    key: string
    value: StoredMutation
    indexes: { byMutationId: string }
  }
  conflicts: {
    key: string
    value: SyncConflict
  }
  workspace: {
    key: string
    value: string
  }
  meta: {
    key: string
    value: unknown
  }
}

function entityKey(entityType: string, entityId: string): string {
  return `${entityType}\u0000${entityId}`
}

function publicMutation(mutation: StoredMutation): SyncMutation {
  const { entityKey: _entityKey, ...rest } = mutation
  return rest
}

function mutationIdFor(
  pending: StoredMutation | undefined,
  operation: SyncMutation['operation'],
  record: SyncMutation['record'],
): string {
  if (
    pending !== undefined &&
    pending.operation === operation &&
    JSON.stringify(pending.record) === JSON.stringify(record)
  ) {
    return pending.id
  }
  return crypto.randomUUID()
}

export class LocalStore {
  private readonly database: IDBPDatabase<LocalDatabase>

  constructor(database: IDBPDatabase<LocalDatabase>) {
    this.database = database
  }

  close(): void {
    this.database.close()
  }

  async initializeDevice(candidate: string = crypto.randomUUID()): Promise<string> {
    const transaction = this.database.transaction('meta', 'readwrite')
    const meta = transaction.objectStore('meta')
    const existing = await meta.get('deviceId')
    const deviceId = typeof existing === 'string' && existing.length > 0 ? existing : candidate
    if (existing === undefined) {
      await Promise.all([meta.put(deviceId, 'deviceId'), meta.put(0, 'cursor')])
    }
    await transaction.done
    return deviceId
  }

  async seed(entities: NormalizedEntity[], deviceId: string, createdAt: string): Promise<boolean> {
    const transaction = this.database.transaction(['entities', 'outbox', 'meta'], 'readwrite')
    if ((await transaction.objectStore('meta').get('seeded')) === true) {
      await transaction.done
      return false
    }

    const writes: Promise<unknown>[] = []
    for (const entity of entities) {
      const key = entityKey(entity.entityType, entity.entityId)
      writes.push(
        transaction.objectStore('entities').put({ ...entity, key, version: 0, updatedAt: null }),
        transaction.objectStore('outbox').put({
          id: crypto.randomUUID(),
          deviceId,
          entityType: entity.entityType,
          entityId: entity.entityId,
          entityKey: key,
          baseVersion: 0,
          operation: 'upsert',
          record: entity.record,
          createdAt,
        }),
      )
    }
    writes.push(
      transaction.objectStore('meta').put(deviceId, 'deviceId'),
      transaction.objectStore('meta').put(0, 'cursor'),
      transaction.objectStore('meta').put(true, 'seeded'),
    )
    await Promise.all(writes)
    await transaction.done
    return true
  }

  async queue(
    entity: NormalizedEntity,
    createdAt: string,
    operation: SyncMutation['operation'] = 'upsert',
  ): Promise<void> {
    const key = entityKey(entity.entityType, entity.entityId)
    const transaction = this.database.transaction(['entities', 'outbox', 'conflicts', 'meta'], 'readwrite')
    const [storedEntity, pending, deviceId] = await Promise.all([
      transaction.objectStore('entities').get(key),
      transaction.objectStore('outbox').get(key),
      transaction.objectStore('meta').get('deviceId'),
    ])
    if (typeof deviceId !== 'string' || deviceId.length === 0) throw new Error('Local device is not initialized.')
    const mutationRecord =
      operation === 'delete' && Object.hasOwn(entity.record, 'deletedAt')
        ? { ...entity.record, deletedAt: null }
        : entity.record
    const localRecord =
      operation === 'delete' && Object.hasOwn(entity.record, 'deletedAt')
        ? { ...entity.record, deletedAt: createdAt }
        : entity.record

    const nextMutationId = mutationIdFor(pending, operation, mutationRecord)
    const writes: Promise<unknown>[] = [
      transaction.objectStore('entities').put({
        ...entity,
        record: localRecord,
        key,
        version: storedEntity?.version ?? 0,
        updatedAt: storedEntity?.updatedAt ?? null,
      }),
      transaction.objectStore('outbox').put({
        id: nextMutationId,
        deviceId,
        entityType: entity.entityType,
        entityId: entity.entityId,
        entityKey: key,
        baseVersion: pending?.baseVersion ?? storedEntity?.version ?? 0,
        operation,
        record: mutationRecord,
        createdAt,
      }),
    ]
    if (pending !== undefined && pending.id !== nextMutationId) {
      writes.push(transaction.objectStore('conflicts').delete(pending.id))
    }
    await Promise.all(writes)
    await transaction.done
  }

  async readEntities(): Promise<StoredEntity[]> {
    return this.database.getAll('entities')
  }

  async reconcile(entities: NormalizedEntity[], createdAt: string): Promise<void> {
    const current = await this.readEntities()
    const incoming = new Map(entities.map((entity) => [entityKey(entity.entityType, entity.entityId), entity]))

    for (const entity of entities) {
      const stored = current.find((candidate) => candidate.key === entityKey(entity.entityType, entity.entityId))
      if (stored === undefined || JSON.stringify(stored.record) !== JSON.stringify(entity.record)) {
        await this.queue(entity, createdAt)
      }
    }
    for (const stored of current) {
      if (incoming.has(stored.key) || stored.record.deletedAt !== null) continue
      await this.queue(stored, createdAt, 'delete')
    }
  }

  async readWorkspace(): Promise<string | undefined> {
    return this.database.get('workspace', 'zustand')
  }

  async readHydrationSnapshot(): Promise<{
    workspace: string | undefined
    entities: StoredEntity[]
    stale: boolean
  }> {
    const transaction = this.database.transaction(['workspace', 'entities', 'meta'], 'readonly')
    const [workspace, entities, cursor, workspaceCursor] = await Promise.all([
      transaction.objectStore('workspace').get('zustand'),
      transaction.objectStore('entities').getAll(),
      transaction.objectStore('meta').get('cursor'),
      transaction.objectStore('meta').get('workspaceCursor'),
    ])
    await transaction.done
    const currentCursor = typeof cursor === 'number' ? cursor : 0
    const snapshotCursor = typeof workspaceCursor === 'number' ? workspaceCursor : 0
    return { workspace, entities, stale: currentCursor !== snapshotCursor }
  }

  async writeHydratedWorkspace(value: string): Promise<void> {
    const transaction = this.database.transaction(['workspace', 'meta'], 'readwrite')
    const cursor = await transaction.objectStore('meta').get('cursor')
    await Promise.all([
      transaction.objectStore('workspace').put(value, 'zustand'),
      transaction.objectStore('meta').put(typeof cursor === 'number' ? cursor : 0, 'workspaceCursor'),
    ])
    await transaction.done
  }

  async writeWorkspace(value: string): Promise<void> {
    await this.database.put('workspace', value, 'zustand')
  }

  async persistWorkspace(
    value: string,
    entities: NormalizedEntity[],
    deviceId: string,
    createdAt: string,
  ): Promise<void> {
    const transaction = this.database.transaction(
      ['workspace', 'entities', 'outbox', 'conflicts', 'meta'],
      'readwrite',
    )
    const [seeded, current, pendingMutations, cursor] = await Promise.all([
      transaction.objectStore('meta').get('seeded'),
      transaction.objectStore('entities').getAll(),
      transaction.objectStore('outbox').getAll(),
      transaction.objectStore('meta').get('cursor'),
    ])
    const entityStore = transaction.objectStore('entities')
    const outboxStore = transaction.objectStore('outbox')
    const currentByKey = new Map(current.map((entity) => [entity.key, entity]))
    const pendingByKey = new Map(pendingMutations.map((mutation) => [mutation.entityKey, mutation]))
    const incoming = new Map(entities.map((entity) => [entityKey(entity.entityType, entity.entityId), entity]))
    const writes: Promise<unknown>[] = [
      transaction.objectStore('workspace').put(value, 'zustand'),
      transaction.objectStore('meta').put(typeof cursor === 'number' ? cursor : 0, 'workspaceCursor'),
    ]

    const queue = (entity: NormalizedEntity, operation: SyncMutation['operation']) => {
      const key = entityKey(entity.entityType, entity.entityId)
      const stored = currentByKey.get(key)
      const pending = pendingByKey.get(key)
      const mutationRecord =
        operation === 'delete' && Object.hasOwn(entity.record, 'deletedAt')
          ? { ...entity.record, deletedAt: null }
          : entity.record
      const localRecord =
        operation === 'delete' && Object.hasOwn(entity.record, 'deletedAt')
          ? { ...entity.record, deletedAt: createdAt }
          : entity.record
      const nextMutationId = mutationIdFor(pending, operation, mutationRecord)
      writes.push(
        entityStore.put({
          ...entity,
          key,
          record: localRecord,
          version: stored?.version ?? 0,
          updatedAt: stored?.updatedAt ?? null,
        }),
        outboxStore.put({
          id: nextMutationId,
          deviceId,
          entityType: entity.entityType,
          entityId: entity.entityId,
          entityKey: key,
          baseVersion: pending?.baseVersion ?? stored?.version ?? 0,
          operation,
          record: mutationRecord,
          createdAt,
        }),
      )
      if (pending !== undefined && pending.id !== nextMutationId) {
        writes.push(transaction.objectStore('conflicts').delete(pending.id))
      }
    }

    if (seeded !== true) {
      for (const entity of entities) queue(entity, 'upsert')
      writes.push(
        transaction.objectStore('meta').put(deviceId, 'deviceId'),
        transaction.objectStore('meta').put(0, 'cursor'),
        transaction.objectStore('meta').put(true, 'seeded'),
      )
    } else {
      for (const entity of entities) {
        const stored = currentByKey.get(entityKey(entity.entityType, entity.entityId))
        if (stored === undefined || JSON.stringify(stored.record) !== JSON.stringify(entity.record)) {
          queue(entity, 'upsert')
        }
      }
      for (const stored of current) {
        if (incoming.has(stored.key) || stored.record.deletedAt !== null) continue
        queue(stored, 'delete')
      }
    }

    await Promise.all(writes)
    await transaction.done
  }

  async pendingMutations(): Promise<SyncMutation[]> {
    return (await this.database.getAll('outbox')).map(publicMutation)
  }

  async conflicts(): Promise<SyncConflict[]> {
    return this.database.getAll('conflicts')
  }

  async resolveConflict(
    mutationId: string,
    resolution: 'local' | 'server',
    createdAt: string,
  ): Promise<void> {
    const transaction = this.database.transaction(['entities', 'outbox', 'conflicts'], 'readwrite')
    const [conflict, mutation] = await Promise.all([
      transaction.objectStore('conflicts').get(mutationId),
      transaction.objectStore('outbox').index('byMutationId').get(mutationId),
    ])
    if (conflict === undefined) throw new Error('Sync conflict no longer exists.')
    if (mutation === undefined) {
      await transaction.objectStore('conflicts').delete(mutationId)
      await transaction.done
      return
    }
    const key = entityKey(conflict.entityType, conflict.entityId)

    if (resolution === 'server') {
      await transaction.objectStore('outbox').delete(mutation.entityKey)
      if (conflict.serverRecord === null) {
        await transaction.objectStore('entities').delete(key)
      } else {
        const { version, updatedAt, ...record } = conflict.serverRecord
        await transaction.objectStore('entities').put({
          key,
          entityType: conflict.entityType,
          entityId: conflict.entityId,
          record,
          version,
          updatedAt,
        })
      }
    } else {
      await transaction.objectStore('outbox').put({
        ...mutation,
        id: crypto.randomUUID(),
        baseVersion: conflict.serverVersion,
        createdAt,
      })
      const stored = await transaction.objectStore('entities').get(key)
      if (stored !== undefined) {
        await transaction.objectStore('entities').put({
          ...stored,
          version: conflict.serverVersion,
          updatedAt: conflict.serverRecord?.updatedAt ?? null,
        })
      }
    }

    await transaction.objectStore('conflicts').delete(mutationId)
    await transaction.done
  }

  async applySyncResponse(response: SyncResponse): Promise<void> {
    const transaction = this.database.transaction(['entities', 'outbox', 'conflicts', 'meta'], 'readwrite')
    const [outbox, storedCursor] = await Promise.all([
      transaction.objectStore('outbox').getAll(),
      transaction.objectStore('meta').get('cursor'),
    ])
    const currentCursor = typeof storedCursor === 'number' ? storedCursor : 0
    if (response.cursor < currentCursor) {
      await transaction.done
      return
    }

    const acknowledged = new Set(response.acknowledged)
    const pendingMutationIds = new Set(outbox.map((mutation) => mutation.id))
    const remaining = new Set(
      outbox.filter((mutation) => !acknowledged.has(mutation.id)).map((mutation) => mutation.entityKey),
    )
    const latestChanges = new Map<string, SyncResponse['changes'][number]>()
    for (const change of response.changes) {
      const key = entityKey(change.entityType, change.entityId)
      const previous = latestChanges.get(key)
      if (
        previous === undefined ||
        change.recordVersion > previous.recordVersion ||
        (change.recordVersion === previous.recordVersion && change.sequence > previous.sequence)
      ) {
        latestChanges.set(key, change)
      }
    }

    await Promise.all(
      outbox
        .filter((mutation) => acknowledged.has(mutation.id))
        .flatMap((mutation) => [
          transaction.objectStore('outbox').delete(mutation.entityKey),
          transaction.objectStore('conflicts').delete(mutation.id),
        ]),
    )
    await Promise.all(
      response.conflicts
        .filter((conflict) => pendingMutationIds.has(conflict.mutationId))
        .map((conflict) => transaction.objectStore('conflicts').put(conflict, conflict.mutationId)),
    )
    await Promise.all(
      [...latestChanges.entries()].map(async ([key, change]) => {
        if (remaining.has(key)) return
        const stored = await transaction.objectStore('entities').get(key)
        if (stored !== undefined && stored.version >= change.recordVersion) return
        const { version, updatedAt, ...record } = change.record
        await transaction.objectStore('entities').put({
          key,
          entityType: change.entityType,
          entityId: change.entityId,
          record,
          version,
          updatedAt,
        })
      }),
    )
    await transaction.objectStore('meta').put(Math.max(currentCursor, response.cursor), 'cursor')
    await transaction.done
  }

  async cursor(): Promise<number> {
    const value = await this.database.get('meta', 'cursor')
    return typeof value === 'number' ? value : 0
  }

  async deviceId(): Promise<string> {
    const value = await this.database.get('meta', 'deviceId')
    if (typeof value !== 'string' || value.length === 0) throw new Error('Local device is not initialized.')
    return value
  }

  async replaceFromServer(
    entityType: NormalizedEntity['entityType'],
    entityId: string,
    record: VersionedRecord,
  ): Promise<void> {
    const key = entityKey(entityType, entityId)
    const { version, updatedAt, ...domainRecord } = record
    await this.database.put('entities', {
      key,
      entityType,
      entityId,
      record: domainRecord,
      version,
      updatedAt,
    })
  }
}

export async function openLocalStore(name = 'seventyfivesoft'): Promise<LocalStore> {
  const database = await openDB<LocalDatabase>(name, 3, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const entities = database.createObjectStore('entities', { keyPath: 'key' })
        entities.createIndex('byType', 'entityType')
        const outbox = database.createObjectStore('outbox', { keyPath: 'entityKey' })
        outbox.createIndex('byMutationId', 'id', { unique: true })
        database.createObjectStore('meta')
      }
      if (oldVersion < 2) database.createObjectStore('conflicts')
      if (oldVersion < 3) database.createObjectStore('workspace')
    },
  })
  return new LocalStore(database)
}
