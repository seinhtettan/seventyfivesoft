import 'fake-indexeddb/auto'
import { deleteDB } from 'idb'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { openLocalStore } from './local-store'
import { syncNow } from './sync-client'
import type { NormalizedEntity } from './normalize-state'

const databases: string[] = []

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

function databaseName(): string {
  const name = `seventyfivesoft-sync-client-${crypto.randomUUID()}`
  databases.push(name)
  return name
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((name) => deleteDB(name)))
})

describe('syncNow', () => {
  test('pushes the outbox, pulls changes, and applies the response', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const pending = (await store.pendingMutations())[0]!
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        deviceId: 'phone',
        cursor: 0,
        mutations: [pending],
      })
      return Response.json({
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
    })

    await syncNow(store, fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      '/api/sync',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(await store.pendingMutations()).toEqual([])
    expect(await store.cursor()).toBe(1)
    store.close()
  })

  test('serializes overlapping synchronization calls for the same store', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
    const pending = (await store.pendingMutations())[0]!
    let releaseFirst!: (response: Response) => void
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        async () =>
          new Promise<Response>((resolve) => {
            releaseFirst = resolve
          }),
      )
      .mockResolvedValueOnce(
        Response.json({ acknowledged: [], conflicts: [], changes: [], cursor: 1 }),
      )

    const first = syncNow(store, fetcher)
    const second = syncNow(store, fetcher)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    releaseFirst(
      Response.json({
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
      }),
    )

    await Promise.all([first, second])

    expect(fetcher).toHaveBeenCalledTimes(2)
    await expect(store.cursor()).resolves.toBe(1)
    store.close()
  })

  test('rejects malformed responses without changing durable state', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')

    await expect(
      syncNow(store, async () =>
        Response.json({ acknowledged: [], conflicts: [], changes: [], cursor: 'invalid' }),
      ),
    ).rejects.toThrow()

    await expect(store.cursor()).resolves.toBe(0)
    await expect(store.pendingMutations()).resolves.toHaveLength(1)
    store.close()
  })

  test('leaves pending mutations untouched when the network fails', async () => {
    const store = await openLocalStore(databaseName())
    await store.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')

    await expect(
      syncNow(store, async () => {
        throw new TypeError('offline')
      }),
    ).rejects.toThrow('offline')

    expect(await store.pendingMutations()).toHaveLength(1)
    expect(await store.cursor()).toBe(0)
    store.close()
  })
})
