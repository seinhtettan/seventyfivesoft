import { parseSyncResponse, type SyncResponse } from '../lib/sync'
import type { LocalStore } from './local-store'

const synchronizationQueues = new WeakMap<LocalStore, Promise<unknown>>()

async function performSync(store: LocalStore, fetcher: typeof fetch): Promise<SyncResponse> {
  const [deviceId, cursor, mutations] = await Promise.all([
    store.deviceId(),
    store.cursor(),
    store.pendingMutations(),
  ])
  const response = await fetcher('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId, cursor, mutations }),
  })
  if (!response.ok) throw new Error(`Synchronization failed with HTTP ${response.status}.`)
  const payload = parseSyncResponse(await response.json())
  await store.applySyncResponse(payload)
  return payload
}

export function syncNow(store: LocalStore, fetcher: typeof fetch = fetch): Promise<SyncResponse> {
  const previous = synchronizationQueues.get(store) ?? Promise.resolve()
  const current = previous
    .catch(() => undefined)
    .then(() => performSync(store, fetcher))
  synchronizationQueues.set(store, current)
  void current.finally(() => {
    if (synchronizationQueues.get(store) === current) synchronizationQueues.delete(store)
  }).catch(() => undefined)
  return current
}
