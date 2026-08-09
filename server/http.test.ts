import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { openDatabase } from './database'
import { handleApiRequest } from './http'

const temporaryDirectories: string[] = []

function openTemporaryDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), 'seventyfivesoft-http-'))
  temporaryDirectories.push(directory)
  return openDatabase(path.join(directory, 'app.sqlite'))
}

function challengeMutation() {
  return {
    id: 'mutation-1',
    deviceId: 'phone',
    entityType: 'challenge',
    entityId: 'challenge-a',
    baseVersion: 0,
    operation: 'upsert',
    record: {
      id: 'challenge-a',
      title: '75 Soft',
      startDate: '2026-08-09',
      durationDays: 75,
      startWeightGrams: null,
      goalWeightGrams: null,
      status: 'active',
      createdAt: '2026-08-09T00:00:00.000Z',
      deletedAt: null,
    },
    createdAt: '2026-08-09T00:00:00.000Z',
  }
}

function habitMutation() {
  return {
    id: 'mutation-habit',
    deviceId: 'phone',
    entityType: 'habit',
    entityId: 'habit-a',
    baseVersion: 0,
    operation: 'upsert',
    record: {
      id: 'habit-a',
      challengeId: 'challenge-a',
      name: 'Walk',
      hint: null,
      icon: 'walk',
      cadence: 'daily',
      weeklyTarget: null,
      weeklyBonus: null,
      sortOrder: 0,
      activeFrom: '2026-08-09',
      activeUntil: '2026-08-08',
      createdAt: '2026-08-09T00:00:00.000Z',
      deletedAt: null,
    },
    createdAt: '2026-08-09T00:00:00.000Z',
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('handleApiRequest', () => {
  test('reports process and database health', async () => {
    const database = openTemporaryDatabase()

    const response = await handleApiRequest(database, new Request('http://localhost/api/health'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok', cursor: 0 })
    database.close()
  })

  test('accepts a valid sync request', async () => {
    const database = openTemporaryDatabase()
    const response = await handleApiRequest(
      database,
      new Request('http://localhost/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: 'phone', cursor: 0, mutations: [] }),
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      acknowledged: [],
      conflicts: [],
      changes: [],
      cursor: 0,
    })
    database.close()
  })

  test('rejects malformed and invalid sync requests', async () => {
    const database = openTemporaryDatabase()
    const malformed = await handleApiRequest(
      database,
      new Request('http://localhost/api/sync', { method: 'POST', body: '{' }),
    )
    const invalid = await handleApiRequest(
      database,
      new Request('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({ deviceId: '', cursor: -1, mutations: [] }),
      }),
    )

    const ambiguousIdentifier = await handleApiRequest(
      database,
      new Request('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({ deviceId: 'phone/other', cursor: 0, mutations: [] }),
      }),
    )

    expect(malformed.status).toBe(400)
    expect(invalid.status).toBe(422)
    expect(ambiguousIdentifier.status).toBe(422)
    database.close()
  })

  test('returns structured client errors for semantic protocol violations', async () => {
    const database = openTemporaryDatabase()
    const mismatched = { ...challengeMutation(), deviceId: 'laptop' }

    const response = await handleApiRequest(
      database,
      new Request('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({ deviceId: 'phone', cursor: 0, mutations: [mismatched] }),
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      message: 'Mutation device does not match request device.',
      code: 'mutation_device_mismatch',
    })
    database.close()
  })

  test('returns a structured client error when record invariants are invalid', async () => {
    const database = openTemporaryDatabase()
    const response = await handleApiRequest(
      database,
      new Request('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: 'phone',
          cursor: 0,
          mutations: [challengeMutation(), habitMutation()],
        }),
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ message: 'Sync request is invalid.' }),
    )
    expect(database.prepare('SELECT COUNT(*) FROM challenges').pluck().get()).toBe(0)
    database.close()
  })

  test('returns a structured client error for missing related records', async () => {
    const database = openTemporaryDatabase()
    const orphan = {
      id: 'orphan-check-in',
      deviceId: 'phone',
      entityType: 'checkIn',
      entityId: 'check-in-a',
      baseVersion: 0,
      operation: 'upsert',
      record: {
        id: 'check-in-a',
        challengeId: 'missing-challenge',
        entryDate: '2026-08-09',
        weightGrams: null,
        mood: null,
        energy: null,
        notes: null,
        createdAt: '2026-08-09T00:00:00.000Z',
        deletedAt: null,
      },
      createdAt: '2026-08-09T00:00:00.000Z',
    }

    const response = await handleApiRequest(
      database,
      new Request('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({ deviceId: 'phone', cursor: 0, mutations: [orphan] }),
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      message: 'Mutation references a related record that does not exist.',
      code: 'related_record_missing',
    })
    expect(database.prepare('SELECT COUNT(*) FROM sync_devices').pluck().get()).toBe(0)
    database.close()
  })

  test('does not expose methods or API routes that are not defined', async () => {
    const database = openTemporaryDatabase()

    const wrongMethod = await handleApiRequest(
      database,
      new Request('http://localhost/api/sync', { method: 'GET' }),
    )
    const missing = await handleApiRequest(database, new Request('http://localhost/api/nope'))

    expect(wrongMethod.status).toBe(405)
    expect(missing.status).toBe(404)
    database.close()
  })
})
