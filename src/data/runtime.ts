import type { SyncConflict } from '@/lib/sync'
import type { NormalizedEntity } from './normalize-state'
import { createAppStateStorage } from './app-storage'
import { openLocalStore } from './local-store'
import { dispatchSettledValue } from './settled-value'
import { syncNow } from './sync-client'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'conflict'

const syncStorePromise = openLocalStore()
const listeners = new Set<() => void>()
const entityListeners = new Set<(entities: NormalizedEntity[]) => void>()
let status: SyncStatus = navigator.onLine ? 'idle' : 'offline'
let running: Promise<void> | undefined
let queued = false
let started = false

function updateStatus(next: SyncStatus): void {
  if (status === next) return
  status = next
  for (const listener of listeners) listener()
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function subscribeSyncedEntities(
  listener: (entities: NormalizedEntity[]) => void,
): () => void {
  entityListeners.add(listener)
  return () => entityListeners.delete(listener)
}

export async function listSyncConflicts(): Promise<SyncConflict[]> {
  return (await syncStorePromise).conflicts()
}

export async function resolveSyncConflict(
  mutationId: string,
  resolution: 'local' | 'server',
): Promise<void> {
  const store = await syncStorePromise
  await store.resolveConflict(mutationId, resolution, new Date().toISOString())
  if (resolution === 'server') {
    await dispatchSettledEntities(store)
  }
  const remaining = await store.conflicts()
  updateStatus(remaining.length > 0 ? 'conflict' : 'idle')
  void requestSync()
}

async function dispatchSettledEntities(
  store: Awaited<typeof syncStorePromise>,
): Promise<void> {
  await dispatchSettledValue(appStateStorage, () => store.readEntities(), (entities) => {
    for (const listener of entityListeners) listener(entities)
  })
}

export function requestSync(): Promise<void> {
  if (!navigator.onLine) {
    updateStatus('offline')
    return Promise.resolve()
  }
  if (running !== undefined) {
    queued = true
    return running
  }

  updateStatus('syncing')
  running = syncStorePromise
    .then(async (store) => {
      await appStateStorage.ready()
      return syncNow(store)
    })
    .then(async () => {
      const store = await syncStorePromise
      await dispatchSettledEntities(store)
      updateStatus((await store.conflicts()).length > 0 ? 'conflict' : 'idle')
    })
    .catch((error: unknown) => {
      console.error('Synchronization failed.', error)
      updateStatus(navigator.onLine ? 'error' : 'offline')
    })
    .finally(() => {
      running = undefined
      if (queued) {
        queued = false
        void requestSync()
      }
    })
  return running
}

export function startSyncLoop(): Promise<void> {
  if (started) return running ?? Promise.resolve()
  started = true
  window.addEventListener('online', requestSync)
  window.addEventListener('offline', () => updateStatus('offline'))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void requestSync()
  })
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void requestSync()
  }, 30_000)
  return requestSync()
}

export const appStateStorage = createAppStateStorage({
  legacyStorage: window.localStorage,
  requestSync,
})
