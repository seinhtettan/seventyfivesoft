import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { openDatabase } from './database'
import { synchronize, type SyncMutation } from './sync'

const temporaryDirectories: string[] = []

function openTemporaryDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), 'seventyfivesoft-sync-'))
  temporaryDirectories.push(directory)
  return openDatabase(path.join(directory, 'app.sqlite'))
}

function challengeMutation(overrides: Partial<SyncMutation> = {}): SyncMutation {
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
    ...overrides,
  }
}

function habitMutation(overrides: Partial<SyncMutation> = {}): SyncMutation {
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
      activeUntil: null,
      createdAt: '2026-08-09T00:00:00.000Z',
      deletedAt: null,
    },
    createdAt: '2026-08-09T00:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('synchronize', () => {
  test('applies a mutation and returns it as a cursor-addressed change', () => {
    const database = openTemporaryDatabase()

    const result = synchronize(database, {
      deviceId: 'phone',
      cursor: 0,
      mutations: [challengeMutation()],
    })

    expect(result.acknowledged).toEqual(['mutation-1'])
    expect(result.conflicts).toEqual([])
    expect(result.cursor).toBe(1)
    expect(result.changes).toEqual([
      expect.objectContaining({
        sequence: 1,
        mutationId: 'mutation-1',
        entityType: 'challenge',
        entityId: 'challenge-a',
        recordVersion: 1,
      }),
    ])
    expect(database.prepare('SELECT title FROM challenges WHERE id = ?').pluck().get('challenge-a')).toBe(
      '75 Soft',
    )

    database.close()
  })

  test('acknowledges a retried mutation without applying it twice', () => {
    const database = openTemporaryDatabase()
    const request = { deviceId: 'phone', cursor: 0, mutations: [challengeMutation()] }

    synchronize(database, request)
    const retry = synchronize(database, request)
    database.prepare('UPDATE sync_changes SET client_created_at = NULL WHERE mutation_id = ?').run('mutation-1')
    const retryAfterV1Upgrade = synchronize(database, request)

    expect(retry.acknowledged).toEqual(['mutation-1'])
    expect(retryAfterV1Upgrade.acknowledged).toEqual(['mutation-1'])
    expect(database.prepare('SELECT COUNT(*) FROM sync_changes').pluck().get()).toBe(1)
    expect(database.prepare('SELECT version FROM challenges WHERE id = ?').pluck().get('challenge-a')).toBe(1)

    database.close()
  })

  test('rejects mutation ID reuse when the mutation content changed', () => {
    const database = openTemporaryDatabase()
    const original = challengeMutation({ id: 'stable-id' })
    synchronize(database, { deviceId: 'phone', cursor: 0, mutations: [original] })

    expect(() =>
      synchronize(database, {
        deviceId: 'phone',
        cursor: 1,
        mutations: [
          challengeMutation({
            id: 'stable-id',
            record: { ...original.record, title: 'Changed after the first request' },
          }),
        ],
      }),
    ).toThrow(/mutation ID.*different/i)
    expect(() =>
      synchronize(database, {
        deviceId: 'phone',
        cursor: 1,
        mutations: [
          challengeMutation({
            id: 'stable-id',
            createdAt: '2026-08-09T00:01:00.000Z',
          }),
        ],
      }),
    ).toThrow(/mutation ID.*different/i)
    expect(database.prepare('SELECT title FROM challenges WHERE id = ?').pluck().get('challenge-a')).toBe(
      '75 Soft',
    )

    database.close()
  })

  test('rejects client-supplied tombstones on upsert', () => {
    const database = openTemporaryDatabase()
    const mutation = challengeMutation({
      record: {
        ...challengeMutation().record,
        deletedAt: '2026-08-09T00:01:00.000Z',
      },
    })

    expect(() =>
      synchronize(database, { deviceId: 'phone', cursor: 0, mutations: [mutation] }),
    ).toThrow(/deletedAt.*null/i)
    expect(database.prepare('SELECT COUNT(*) FROM challenges').pluck().get()).toBe(0)

    database.close()
  })

  test('returns a stale-write conflict without replacing the newer record', () => {
    const database = openTemporaryDatabase()
    synchronize(database, { deviceId: 'phone', cursor: 0, mutations: [challengeMutation()] })

    const result = synchronize(database, {
      deviceId: 'laptop',
      cursor: 1,
      mutations: [
        challengeMutation({
          id: 'mutation-2',
          deviceId: 'laptop',
          record: { ...challengeMutation().record, title: 'Stale title' },
        }),
      ],
    })

    expect(result.acknowledged).toEqual([])
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        mutationId: 'mutation-2',
        entityType: 'challenge',
        entityId: 'challenge-a',
        serverVersion: 1,
        serverRecord: expect.objectContaining({ title: '75 Soft' }),
      }),
    ])
    expect(database.prepare('SELECT title FROM challenges WHERE id = ?').pluck().get('challenge-a')).toBe(
      '75 Soft',
    )

    database.close()
  })

  test('applies valid dependent records regardless of request order', () => {
    const database = openTemporaryDatabase()

    const result = synchronize(database, {
      deviceId: 'phone',
      cursor: 0,
      mutations: [habitMutation(), challengeMutation()],
    })

    expect(result.acknowledged).toEqual(expect.arrayContaining(['mutation-1', 'mutation-habit']))
    expect(database.prepare('SELECT COUNT(*) FROM challenges').pluck().get()).toBe(1)
    expect(database.prepare('SELECT COUNT(*) FROM habits').pluck().get()).toBe(1)

    database.close()
  })

  test('persists every application entity through the same replication contract', () => {
    const database = openTemporaryDatabase()
    const at = '2026-08-09T00:00:00.000Z'
    const mutation = (
      id: string,
      entityType: string,
      entityId: string,
      record: Record<string, unknown>,
    ): SyncMutation =>
      ({
        id,
        deviceId: 'phone',
        entityType,
        entityId,
        baseVersion: 0,
        operation: 'upsert',
        record,
        createdAt: at,
      }) as SyncMutation

    const mutations = [
      mutation('m-profile', 'profile', 'profile', {
        id: 1,
        displayName: 'Erica',
        age: null,
        heightCm: null,
      }),
      mutation('m-preferences', 'preferences', 'preferences', {
        id: 1,
        weightUnit: 'kg',
        timezone: 'Asia/Singapore',
      }),
      challengeMutation({ id: 'm-challenge' }),
      mutation('m-habit', 'habit', 'walk', {
        id: 'walk',
        challengeId: 'challenge-a',
        name: 'Walk',
        hint: null,
        icon: 'walk',
        cadence: 'daily',
        weeklyTarget: null,
        weeklyBonus: null,
        sortOrder: 0,
        activeFrom: '2026-08-09',
        activeUntil: null,
        createdAt: at,
        deletedAt: null,
      }),
      mutation('m-metric', 'habitMetric', 'walk-minutes', {
        id: 'walk-minutes',
        challengeId: 'challenge-a',
        habitId: 'walk',
        label: 'Minutes walked',
        unit: 'min',
        target: 60,
        step: 5,
        minimum: 0,
        maximum: 240,
        sortOrder: 0,
        createdAt: at,
        deletedAt: null,
      }),
      mutation('m-habit-entry', 'habitEntry', 'challenge-a/walk/2026-08-09', {
        challengeId: 'challenge-a',
        habitId: 'walk',
        entryDate: '2026-08-09',
        completed: true,
        deletedAt: null,
      }),
      mutation('m-metric-entry', 'metricEntry', 'challenge-a/walk-minutes/2026-08-09', {
        challengeId: 'challenge-a',
        metricId: 'walk-minutes',
        entryDate: '2026-08-09',
        value: 60,
        deletedAt: null,
      }),
      mutation('m-journal', 'journal', 'challenge-a/2026-08-09', {
        challengeId: 'challenge-a',
        entryDate: '2026-08-09',
        win: 'Went outside',
        gratitude: '',
        feeling: '',
        notes: '',
        deletedAt: null,
      }),
      mutation('m-reflection', 'weeklyReflection', 'challenge-a/0', {
        challengeId: 'challenge-a',
        weekIndex: 0,
        energy: 4,
        mood: 5,
        win: 'Started',
        intention: 'Continue',
        deletedAt: null,
      }),
      mutation('m-check-in', 'checkIn', 'check-in-1', {
        id: 'check-in-1',
        challengeId: 'challenge-a',
        entryDate: '2026-08-09',
        weightGrams: 65000,
        mood: 5,
        energy: 4,
        notes: null,
        createdAt: at,
        deletedAt: null,
      }),
    ]

    const result = synchronize(database, { deviceId: 'phone', cursor: 0, mutations })

    expect(result.acknowledged).toHaveLength(mutations.length)
    expect(result.conflicts).toEqual([])
    expect(database.prepare('SELECT COUNT(*) FROM profile').pluck().get()).toBe(1)
    expect(database.prepare('SELECT COUNT(*) FROM preferences').pluck().get()).toBe(1)
    expect(database.prepare('SELECT COUNT(*) FROM habits').pluck().get()).toBe(1)
    expect(database.prepare('SELECT COUNT(*) FROM habit_metrics').pluck().get()).toBe(1)
    expect(database.prepare('SELECT COUNT(*) FROM habit_entries').pluck().get()).toBe(1)
    expect(database.prepare('SELECT COUNT(*) FROM metric_entries').pluck().get()).toBe(1)
    expect(database.prepare('SELECT COUNT(*) FROM journals').pluck().get()).toBe(1)
    expect(database.prepare('SELECT COUNT(*) FROM weekly_reflections').pluck().get()).toBe(1)
    expect(database.prepare('SELECT COUNT(*) FROM check_ins').pluck().get()).toBe(1)

    database.close()
  })

  test('propagates deletions as versioned tombstones', () => {
    const database = openTemporaryDatabase()
    synchronize(database, { deviceId: 'phone', cursor: 0, mutations: [challengeMutation()] })

    const result = synchronize(database, {
      deviceId: 'phone',
      cursor: 1,
      mutations: [
        challengeMutation({
          id: 'mutation-delete',
          baseVersion: 1,
          operation: 'delete',
        }),
      ],
    })

    expect(result.acknowledged).toEqual(['mutation-delete'])
    expect(result.changes).toEqual([
      expect.objectContaining({
        mutationId: 'mutation-delete',
        operation: 'delete',
        recordVersion: 2,
        record: expect.objectContaining({ version: 2, deletedAt: expect.any(String) }),
      }),
    ])
    expect(
      database
        .prepare('SELECT version, deleted_at FROM challenges WHERE id = ?')
        .get('challenge-a'),
    ).toEqual(expect.objectContaining({ version: 2, deleted_at: expect.any(String) }))

    database.close()
  })

  test('resets a cursor ahead of the server to a full replay', () => {
    const database = openTemporaryDatabase()
    synchronize(database, { deviceId: 'phone', cursor: 0, mutations: [challengeMutation()] })

    const result = synchronize(database, { deviceId: 'restored', cursor: 999, mutations: [] })

    expect(result.cursor).toBe(1)
    expect(result.changes).toEqual([
      expect.objectContaining({ mutationId: 'mutation-1', entityId: 'challenge-a' }),
    ])

    database.close()
  })

  test('pulls changes made by another device after its cursor', () => {
    const database = openTemporaryDatabase()
    synchronize(database, { deviceId: 'phone', cursor: 0, mutations: [challengeMutation()] })

    const result = synchronize(database, { deviceId: 'laptop', cursor: 0, mutations: [] })

    expect(result.changes).toHaveLength(1)
    expect(result.cursor).toBe(1)

    database.close()
  })
})
