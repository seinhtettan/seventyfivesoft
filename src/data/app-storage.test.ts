import 'fake-indexeddb/auto'
import { deleteDB } from 'idb'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { AppState } from '@/lib/types'
import { createAppStateStorage } from './app-storage'
import { openLocalStore } from './local-store'
import { normalizeState } from './normalize-state'

const databases: string[] = []

function databaseName(): string {
  const name = `seventyfivesoft-app-storage-${crypto.randomUUID()}`
  databases.push(name)
  return name
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((name) => deleteDB(name)))
})

function persisted(name = 'Erica'): string {
  const state: AppState = {
    onboarded: true,
    profile: { name },
    challenge: { startDate: '2026-08-09', totalDays: 75 },
    habits: [],
    settings: { unit: 'kg' },
    days: {},
    reflections: {},
    progress: [],
  }
  return JSON.stringify({ state, version: 1 })
}

function stateFromValue(value: string): AppState {
  return (JSON.parse(value) as { state: AppState }).state
}

function memoryStorage(values: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(values))
  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, value),
  }
}

describe('createAppStateStorage', () => {
  test('initializes a fresh browser replica before its first local edit', async () => {
    const name = databaseName()
    const legacy = memoryStorage()
    const storage = createAppStateStorage({
      databaseName: name,
      legacyStorage: legacy,
      requestSync: vi.fn(),
    })

    await expect(storage.getItem('75soft:v1')).resolves.toBeNull()

    const store = await openLocalStore(name)
    await expect(store.deviceId()).resolves.toMatch(/^[a-f0-9-]{36}$/)
    expect(legacy.getItem('75soft:device-id')).toBeNull()
    await expect(store.cursor()).resolves.toBe(0)
    expect(await store.pendingMutations()).toEqual([])
    store.close()
    await storage.close()
  })

  test('does not queue onboarding defaults on a fresh replica', async () => {
    const name = databaseName()
    const storage = createAppStateStorage({
      databaseName: name,
      legacyStorage: memoryStorage(),
      requestSync: vi.fn(),
    })
    const onboarding: AppState = {
      onboarded: false,
      profile: { name: '' },
      challenge: { id: 'random-placeholder', startDate: '2026-08-09', totalDays: 75 },
      habits: [],
      settings: { unit: 'lb' },
      days: {},
      reflections: {},
      progress: [],
    }

    await storage.setItem('75soft:v1', JSON.stringify({ state: onboarding, version: 1 }))

    const store = await openLocalStore(name)
    await expect(store.pendingMutations()).resolves.toEqual([])
    await expect(store.readEntities()).resolves.toEqual([])
    store.close()
    await storage.close()
  })

  test('keeps the IndexedDB replica ID when localStorage has diverged', async () => {
    const name = databaseName()
    const seededStore = await openLocalStore(name)
    await seededStore.initializeDevice('indexeddb-device')
    seededStore.close()
    const legacy = memoryStorage({ '75soft:device-id': 'stale-localstorage-device' })
    const storage = createAppStateStorage({
      databaseName: name,
      legacyStorage: legacy,
      requestSync: vi.fn(),
    })

    await storage.ready()

    const store = await openLocalStore(name)
    await expect(store.deviceId()).resolves.toBe('indexeddb-device')
    store.close()
    await storage.close()
  })

  test('imports the existing localStorage snapshot into IndexedDB once', async () => {
    const name = databaseName()
    const legacy = memoryStorage({ '75soft:v1': persisted() })
    const storage = createAppStateStorage({
      databaseName: name,
      legacyStorage: legacy,
      now: () => '2026-08-09T00:00:00.000Z',
      requestSync: vi.fn(),
    })

    await expect(storage.getItem('75soft:v1')).resolves.toBe(persisted())

    const store = await openLocalStore(name)
    await expect(store.readWorkspace()).resolves.toBe(persisted())
    expect(await store.pendingMutations()).not.toHaveLength(0)
    expect(legacy.getItem('75soft:v1')).toBeNull()
    store.close()
    await storage.close()
  })

  test('rebuilds hydration state when synchronized entities exist without a workspace', async () => {
    const name = databaseName()
    const store = await openLocalStore(name)
    const state = stateFromValue(persisted('Recovered'))
    await store.seed(normalizeState(state, '2026-08-09T00:00:00.000Z'), 'phone', '2026-08-09T00:00:00.000Z')
    store.close()
    const storage = createAppStateStorage({
      databaseName: name,
      legacyStorage: memoryStorage(),
      requestSync: vi.fn(),
    })

    const hydrated = await storage.getItem('75soft:v1')

    expect(hydrated).not.toBeNull()
    expect(stateFromValue(hydrated!).onboarded).toBe(true)
    expect(stateFromValue(hydrated!).profile.name).toBe('Recovered')
    const reopened = await openLocalStore(name)
    await expect(reopened.readWorkspace()).resolves.toBe(hydrated)
    reopened.close()
    await storage.close()
  })

  test('repairs a stale workspace from synchronized entities before hydration', async () => {
    const name = databaseName()
    const storage = createAppStateStorage({
      databaseName: name,
      legacyStorage: memoryStorage(),
      now: () => '2026-08-09T00:00:00.000Z',
      requestSync: vi.fn(),
    })
    await storage.setItem('75soft:v1', persisted('Local'))

    const store = await openLocalStore(name)
    const pending = await store.pendingMutations()
    await store.applySyncResponse({
      acknowledged: pending.map((mutation) => mutation.id),
      conflicts: [],
      cursor: 1,
      changes: [
        {
          sequence: 1,
          mutationId: 'remote-profile',
          deviceId: 'other-device',
          entityType: 'profile',
          entityId: 'profile',
          recordVersion: 1,
          operation: 'upsert',
          record: {
            id: 1,
            displayName: 'Remote',
            age: null,
            heightCm: null,
            version: 1,
            updatedAt: '2026-08-09T00:01:00.000Z',
          },
          createdAt: '2026-08-09T00:01:00.000Z',
        },
      ],
    })
    store.close()

    const hydrated = await storage.getItem('75soft:v1')

    expect(stateFromValue(hydrated!).profile.name).toBe('Remote')
    const reopened = await openLocalStore(name)
    expect(stateFromValue((await reopened.readWorkspace())!).profile.name).toBe('Remote')
    reopened.close()
    await storage.close()
  })

  test('persists and reconciles subsequent Zustand snapshots', async () => {
    const name = databaseName()
    const requestSync = vi.fn()
    const storage = createAppStateStorage({
      databaseName: name,
      legacyStorage: memoryStorage(),
      now: () => '2026-08-09T00:00:00.000Z',
      requestSync,
    })

    await storage.setItem('75soft:v1', persisted())
    await storage.setItem('75soft:v1', persisted('Updated'))

    const store = await openLocalStore(name)
    await expect(store.readWorkspace()).resolves.toBe(persisted('Updated'))
    expect(await store.pendingMutations()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'profile',
          record: expect.objectContaining({ displayName: 'Updated' }),
        }),
      ]),
    )
    expect(requestSync).toHaveBeenCalled()
    store.close()
    await storage.close()
  })
})
