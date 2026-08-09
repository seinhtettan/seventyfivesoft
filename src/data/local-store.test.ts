import 'fake-indexeddb/auto'
import { deleteDB } from 'idb'
import { afterEach, describe, expect, test } from 'vitest'
import type { NormalizedEntity } from './normalize-state'
import { openLocalStore } from './local-store'

const databases: string[] = []

function databaseName(): string {
  const name = `seventyfivesoft-${crypto.randomUUID()}`
  databases.push(name)
  return name
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((name) => deleteDB(name)))
})

const challenge: NormalizedEntity = {
  entityType: 'challenge',
  entityId: 'challenge:a',
  record: {
    id: 'challenge:a',
    title: '75 Soft',
    startDate: '2026-08-09',
    durationDays: 75,
    startWeightGrams: null,
    goalWeightGrams: null,
    status: 'active',
    createdAt: '2026-08-09T00:00:00.000Z',
    deletedAt: null,
  },
}

describe('LocalStore', () => {
  test('seeds normalized records and queues them for first synchronization atomically', async () => {
    const store = await openLocalStore(databaseName())

    const seeded = await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')

    expect(seeded).toBe(true)
    expect(await store.readEntities()).toEqual([
      expect.objectContaining({ entityType: 'challenge', entityId: 'challenge:a', version: 0 }),
    ])
    expect(await store.pendingMutations()).toEqual([
      expect.objectContaining({
        deviceId: 'phone',
        entityType: 'challenge',
        entityId: 'challenge:a',
        baseVersion: 0,
      }),
    ])
    expect(await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')).toBe(false)
    store.close()
  })

  test('coalesces repeated offline edits with a new mutation ID and the original base version', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')

    await store.queue(
      { ...challenge, record: { ...challenge.record, title: 'First edit' } },
      '2026-08-09T01:00:00.000Z',
    )
    const firstEdit = (await store.pendingMutations())[0]!
    await store.queue(
      { ...challenge, record: { ...challenge.record, title: 'Second edit' } },
      '2026-08-09T02:00:00.000Z',
    )

    expect(await store.pendingMutations()).toEqual([
      expect.objectContaining({
        id: expect.not.stringMatching(firstEdit.id),
        baseVersion: 0,
        record: expect.objectContaining({ title: 'Second edit' }),
      }),
    ])
    expect(await store.readEntities()).toEqual([
      expect.objectContaining({ record: expect.objectContaining({ title: 'Second edit' }) }),
    ])
    store.close()
  })

  test('does not clear a newer offline edit when an older in-flight mutation is acknowledged', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const inFlight = (await store.pendingMutations())[0]!

    await store.queue(
      { ...challenge, record: { ...challenge.record, title: 'Newer offline edit' } },
      '2026-08-09T00:01:00.000Z',
    )
    await store.applySyncResponse({
      acknowledged: [inFlight.id],
      conflicts: [],
      cursor: 1,
      changes: [
        {
          sequence: 1,
          mutationId: inFlight.id,
          deviceId: 'phone',
          entityType: 'challenge',
          entityId: 'challenge:a',
          recordVersion: 1,
          operation: 'upsert',
          record: { ...challenge.record, version: 1, updatedAt: '2026-08-09T00:01:00.000Z' },
          createdAt: '2026-08-09T00:01:00.000Z',
        },
      ],
    })

    expect(await store.pendingMutations()).toEqual([
      expect.objectContaining({
        id: expect.not.stringMatching(inFlight.id),
        record: expect.objectContaining({ title: 'Newer offline edit' }),
      }),
    ])
    expect(await store.readEntities()).toEqual([
      expect.objectContaining({ record: expect.objectContaining({ title: 'Newer offline edit' }) }),
    ])
    store.close()
  })

  test('ignores a stale conflict after a newer offline edit replaced its mutation', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const inFlight = (await store.pendingMutations())[0]!
    await store.queue(
      { ...challenge, record: { ...challenge.record, title: 'Newer offline edit' } },
      '2026-08-09T00:01:00.000Z',
    )

    await store.applySyncResponse({
      acknowledged: [],
      changes: [],
      cursor: 1,
      conflicts: [
        {
          mutationId: inFlight.id,
          entityType: 'challenge',
          entityId: 'challenge:a',
          serverVersion: 1,
          serverRecord: {
            ...challenge.record,
            version: 1,
            updatedAt: '2026-08-09T00:01:00.000Z',
          },
        },
      ],
    })

    await expect(store.conflicts()).resolves.toEqual([])
    await expect(store.pendingMutations()).resolves.toEqual([
      expect.objectContaining({
        id: expect.not.stringMatching(inFlight.id),
        record: expect.objectContaining({ title: 'Newer offline edit' }),
      }),
    ])
    store.close()
  })

  test('deletes a stored conflict when a newer local edit replaces its mutation', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const conflicted = (await store.pendingMutations())[0]!
    await store.applySyncResponse({
      acknowledged: [],
      changes: [],
      cursor: 1,
      conflicts: [
        {
          mutationId: conflicted.id,
          entityType: 'challenge',
          entityId: 'challenge:a',
          serverVersion: 1,
          serverRecord: {
            ...challenge.record,
            title: 'Server edit',
            version: 1,
            updatedAt: '2026-08-09T00:01:00.000Z',
          },
        },
      ],
    })
    await expect(store.conflicts()).resolves.toHaveLength(1)

    await store.queue(
      { ...challenge, record: { ...challenge.record, title: 'New local generation' } },
      '2026-08-09T00:02:00.000Z',
    )

    await expect(store.conflicts()).resolves.toEqual([])
    await expect(store.pendingMutations()).resolves.toEqual([
      expect.objectContaining({
        id: expect.not.stringMatching(conflicted.id),
        record: expect.objectContaining({ title: 'New local generation' }),
      }),
    ])
    store.close()
  })

  test('does not regress cursor or entities when an older response arrives late', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const pending = (await store.pendingMutations())[0]!
    const change = (version: number, title: string) => ({
      sequence: version,
      mutationId: `remote-${version}`,
      deviceId: 'other-device',
      entityType: 'challenge' as const,
      entityId: 'challenge:a',
      recordVersion: version,
      operation: 'upsert' as const,
      record: {
        ...challenge.record,
        title,
        version,
        updatedAt: `2026-08-09T00:0${version}:00.000Z`,
      },
      createdAt: `2026-08-09T00:0${version}:00.000Z`,
    })
    await store.applySyncResponse({
      acknowledged: [pending.id],
      conflicts: [],
      changes: [change(1, 'Version one')],
      cursor: 1,
    })
    await store.applySyncResponse({
      acknowledged: [],
      conflicts: [],
      changes: [change(2, 'Version two')],
      cursor: 2,
    })

    await store.applySyncResponse({
      acknowledged: [],
      conflicts: [],
      changes: [change(1, 'Late version one')],
      cursor: 1,
    })

    await expect(store.cursor()).resolves.toBe(2)
    await expect(store.readEntities()).resolves.toEqual([
      expect.objectContaining({
        version: 2,
        record: expect.objectContaining({ title: 'Version two' }),
      }),
    ])
    store.close()
  })

  test('applies acknowledgements and remote changes atomically', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const pending = (await store.pendingMutations())[0]!

    await store.applySyncResponse({
      acknowledged: [pending.id],
      conflicts: [],
      cursor: 1,
      changes: [
        {
          sequence: 1,
          mutationId: pending.id,
          deviceId: 'phone',
          entityType: 'challenge',
          entityId: 'challenge:a',
          recordVersion: 1,
          operation: 'upsert',
          record: {
            ...challenge.record,
            version: 1,
            updatedAt: '2026-08-09T00:01:00.000Z',
          },
          createdAt: '2026-08-09T00:01:00.000Z',
        },
      ],
    })

    expect(await store.pendingMutations()).toEqual([])
    expect(await store.cursor()).toBe(1)
    expect(await store.readEntities()).toEqual([
      expect.objectContaining({ version: 1, updatedAt: '2026-08-09T00:01:00.000Z' }),
    ])
    store.close()
  })

  test('retains pending data when the server reports a conflict', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const pending = (await store.pendingMutations())[0]!

    await store.applySyncResponse({
      acknowledged: [],
      changes: [],
      cursor: 1,
      conflicts: [
        {
          mutationId: pending.id,
          entityType: 'challenge',
          entityId: 'challenge:a',
          serverVersion: 1,
          serverRecord: {
            ...challenge.record,
            title: 'Changed elsewhere',
            version: 1,
            updatedAt: '2026-08-09T00:01:00.000Z',
          },
        },
      ],
    })

    expect(await store.pendingMutations()).toHaveLength(1)
    expect(await store.conflicts()).toEqual([
      expect.objectContaining({ mutationId: pending.id, serverVersion: 1 }),
    ])
    store.close()
  })

  test('resolves a conflict with the server record', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const pending = (await store.pendingMutations())[0]!
    await store.applySyncResponse({
      acknowledged: [],
      changes: [],
      cursor: 1,
      conflicts: [
        {
          mutationId: pending.id,
          entityType: 'challenge',
          entityId: 'challenge:a',
          serverVersion: 1,
          serverRecord: {
            ...challenge.record,
            title: 'Changed elsewhere',
            version: 1,
            updatedAt: '2026-08-09T00:01:00.000Z',
          },
        },
      ],
    })

    await store.resolveConflict(pending.id, 'server', '2026-08-09T00:02:00.000Z')

    expect(await store.pendingMutations()).toEqual([])
    expect(await store.conflicts()).toEqual([])
    expect(await store.readEntities()).toEqual([
      expect.objectContaining({
        version: 1,
        record: expect.objectContaining({ title: 'Changed elsewhere' }),
      }),
    ])
    store.close()
  })

  test('rebases a local conflict for retry', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    await store.queue(
      { ...challenge, record: { ...challenge.record, title: 'Keep local' } },
      '2026-08-09T00:00:30.000Z',
    )
    const pending = (await store.pendingMutations())[0]!
    await store.applySyncResponse({
      acknowledged: [],
      changes: [],
      cursor: 1,
      conflicts: [
        {
          mutationId: pending.id,
          entityType: 'challenge',
          entityId: 'challenge:a',
          serverVersion: 1,
          serverRecord: {
            ...challenge.record,
            title: 'Changed elsewhere',
            version: 1,
            updatedAt: '2026-08-09T00:01:00.000Z',
          },
        },
      ],
    })

    await store.resolveConflict(pending.id, 'local', '2026-08-09T00:02:00.000Z')

    expect(await store.conflicts()).toEqual([])
    expect(await store.pendingMutations()).toEqual([
      expect.objectContaining({
        id: expect.not.stringMatching(pending.id),
        baseVersion: 1,
        record: expect.objectContaining({ title: 'Keep local' }),
      }),
    ])
    store.close()
  })

  test('reconciles changed and removed records into the outbox', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const pending = (await store.pendingMutations())[0]!
    await store.applySyncResponse({
      acknowledged: [pending.id],
      conflicts: [],
      cursor: 1,
      changes: [
        {
          sequence: 1,
          mutationId: pending.id,
          deviceId: 'phone',
          entityType: 'challenge',
          entityId: 'challenge:a',
          recordVersion: 1,
          operation: 'upsert',
          record: { ...challenge.record, version: 1, updatedAt: '2026-08-09T00:01:00.000Z' },
          createdAt: '2026-08-09T00:01:00.000Z',
        },
      ],
    })

    await store.reconcile(
      [{ ...challenge, record: { ...challenge.record, title: 'Changed offline' } }],
      '2026-08-09T01:00:00.000Z',
    )
    expect(await store.pendingMutations()).toEqual([
      expect.objectContaining({ baseVersion: 1, operation: 'upsert' }),
    ])

    await store.reconcile([], '2026-08-09T02:00:00.000Z')
    expect(await store.pendingMutations()).toEqual([
      expect.objectContaining({
        baseVersion: 1,
        operation: 'delete',
        record: expect.objectContaining({ deletedAt: null }),
      }),
    ])
    expect(await store.readEntities()).toEqual([
      expect.objectContaining({ record: expect.objectContaining({ deletedAt: '2026-08-09T02:00:00.000Z' }) }),
    ])
    store.close()
  })

  test('persists the Zustand snapshot separately from synchronization records', async () => {
    const name = databaseName()
    const store = await openLocalStore(name)
    await store.writeWorkspace('{"state":{"onboarded":true},"version":1}')
    store.close()

    const reopened = await openLocalStore(name)
    await expect(reopened.readWorkspace()).resolves.toBe('{"state":{"onboarded":true},"version":1}')
    reopened.close()
  })
})
