import type { StateStorage } from 'zustand/middleware'
import type { AppState } from '@/lib/types'
import { materializeState } from './materialize-state'
import { createInitialState } from './initial-state'
import { openLocalStore, type StoredEntity } from './local-store'
import { normalizeState } from './normalize-state'

interface AppStateStorageOptions {
  databaseName?: string
  legacyStorage: Storage
  now?: () => string
  requestSync: () => void | Promise<void>
}

export interface AppStateStorage extends StateStorage {
  ready: () => Promise<void>
  close: () => Promise<void>
}

function stateFromPersisted(value: string): AppState {
  const parsed = JSON.parse(value) as { state?: unknown }
  if (parsed === null || typeof parsed !== 'object' || parsed.state === null || typeof parsed.state !== 'object') {
    throw new Error('Persisted application state is invalid.')
  }
  return parsed.state as AppState
}

function materializedPersisted(value: string, entities: StoredEntity[]): string {
  const parsed = JSON.parse(value) as { state: AppState; version?: number }
  return JSON.stringify({
    ...parsed,
    state: materializeState(entities, parsed.state),
  })
}

export function createAppStateStorage(options: AppStateStorageOptions): AppStateStorage {
  const now = options.now ?? (() => new Date().toISOString())
  let writeChain = Promise.resolve()

  const storePromise = openLocalStore(options.databaseName)
  const replicaIdPromise = storePromise.then((store) => store.initializeDevice())

  const persist = async (value: string): Promise<void> => {
    const replicaId = await replicaIdPromise
    const store = await storePromise
    const timestamp = now()
    const entities = normalizeState(stateFromPersisted(value), timestamp)
    await store.persistWorkspace(value, entities, replicaId, timestamp)
    void Promise.resolve(options.requestSync()).catch(() => undefined)
  }

  return {
    async ready() {
      await replicaIdPromise
    },
    async getItem(name) {
      await replicaIdPromise
      await writeChain
      const store = await storePromise
      const snapshot = await store.readHydrationSnapshot()
      if (snapshot.entities.length > 0 && (snapshot.workspace === undefined || snapshot.stale)) {
        const fallback =
          snapshot.workspace ?? JSON.stringify({ state: createInitialState(), version: 1 })
        const repaired = materializedPersisted(fallback, snapshot.entities)
        await store.writeHydratedWorkspace(repaired)
        return repaired
      }
      if (snapshot.workspace !== undefined) return snapshot.workspace
      const legacy = options.legacyStorage.getItem(name)
      if (legacy === null) return null
      await persist(legacy)
      options.legacyStorage.removeItem(name)
      return legacy
    },
    async setItem(_name, value) {
      writeChain = writeChain.then(() => persist(value))
      await writeChain
    },
    async removeItem() {
      writeChain = writeChain.then(async () => {
        const store = await storePromise
        await store.writeWorkspace('')
      })
      await writeChain
    },
    async close() {
      await writeChain
      const store = await storePromise
      store.close()
    },
  }
}
