import 'fake-indexeddb/auto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deleteDB } from 'idb'
import { describe, expect, test } from 'vitest'
import { openDatabase } from '../../server/database'
import { handleApiRequest } from '../../server/http'
import { bootstrapOfflineClient } from './bootstrap'
import { createInitialState } from './initial-state'
import { materializeState } from './materialize-state'
import type { NormalizedEntity } from './normalize-state'
import { openLocalStore } from './local-store'
import { syncNow } from './sync-client'

const challenge: NormalizedEntity = {
  entityType: 'challenge',
  entityId: 'challenge:stable',
  record: {
    id: 'challenge:stable',
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

describe('browser-to-server replication', () => {
  test('uploads from one browser and hydrates an empty second browser', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'seventyfivesoft-replication-'))
    const database = openDatabase(path.join(directory, 'app.sqlite'))
    const phoneName = `seventyfivesoft-phone-${crypto.randomUUID()}`
    const laptopName = `seventyfivesoft-laptop-${crypto.randomUUID()}`
    const phone = await openLocalStore(phoneName)
    const laptop = await openLocalStore(laptopName)
    const fetcher = (input: RequestInfo | URL, init?: RequestInit) =>
      handleApiRequest(database, new Request(new URL(String(input), 'http://localhost'), init))

    try {
      await phone.seed([challenge], 'phone', '2026-08-09T00:00:00.000Z')
      await laptop.initializeDevice('laptop')

      const upload = await syncNow(phone, fetcher)
      let laptopState = createInitialState()
      let rendered = false
      let downloadChanges = 0
      const bootstrap = bootstrapOfflineClient({
        isHydrated: () => true,
        subscribeHydration: () => () => undefined,
        subscribeEntities: () => undefined,
        synchronize: async () => {
          const download = await syncNow(laptop, fetcher)
          downloadChanges = download.changes.length
          laptopState = materializeState(await laptop.readEntities(), laptopState)
        },
        render: () => {
          rendered = true
        },
      })

      expect(rendered).toBe(false)
      await bootstrap

      expect(upload.acknowledged).toHaveLength(1)
      expect(downloadChanges).toBe(1)
      expect(rendered).toBe(true)
      expect(laptopState.onboarded).toBe(true)
      expect(laptopState.challenge.id).toBe('challenge:stable')
      expect(await laptop.readEntities()).toEqual([
        expect.objectContaining({
          entityType: 'challenge',
          entityId: 'challenge:stable',
          version: 1,
          record: expect.objectContaining({ title: '75 Soft' }),
        }),
      ])
      expect(await laptop.cursor()).toBe(1)
    } finally {
      phone.close()
      laptop.close()
      database.close()
      await Promise.all([deleteDB(phoneName), deleteDB(laptopName)])
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
