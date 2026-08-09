import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, test } from 'vitest'
import { openDatabase } from './database'

const execFileAsync = promisify(execFile)

const temporaryDirectories: string[] = []

function databasePath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'seventyfivesoft-'))
  temporaryDirectories.push(directory)
  return path.join(directory, 'app.sqlite')
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('openDatabase', () => {
  test('creates the normalized application and sync schema', () => {
    const database = openDatabase(databasePath())

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name)

    expect(tables).toEqual([
      'challenges',
      'check_ins',
      'habit_entries',
      'habit_metrics',
      'habits',
      'journals',
      'metric_entries',
      'preferences',
      'profile',
      'schema_migrations',
      'sync_changes',
      'sync_devices',
      'weekly_reflections',
    ])
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(database.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(database.prepare('SELECT version FROM schema_migrations').pluck().all()).toEqual([1])

    database.close()
  })

  test('stores challenge data with relational ownership', () => {
    const database = openDatabase(databasePath())
    const now = '2026-08-09T00:00:00.000Z'

    database
      .prepare(
        `INSERT INTO challenges (
          id, title, start_date, duration_days, status, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('challenge-a', '75 Soft', '2026-08-09', 75, 'active', 1, now, now)
    database
      .prepare(
        `INSERT INTO habits (
          id, challenge_id, name, icon, cadence, sort_order, active_from,
          version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('walk', 'challenge-a', 'Walk', 'walk', 'daily', 0, '2026-08-09', 1, now, now)
    database
      .prepare(
        `INSERT INTO habit_entries (
          challenge_id, habit_id, entry_date, completed, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('challenge-a', 'walk', '2026-08-09', 1, 1, now)

    expect(
      database
        .prepare('SELECT completed FROM habit_entries WHERE challenge_id = ? AND habit_id = ?')
        .pluck()
        .get('challenge-a', 'walk'),
    ).toBe(1)

    expect(() =>
      database
        .prepare(
          `INSERT INTO habit_entries (
            challenge_id, habit_id, entry_date, completed, version, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('another-challenge', 'walk', '2026-08-09', 1, 1, now),
    ).toThrow()

    database.close()
  })

  test('rejects text identities without a value', () => {
    const database = openDatabase(databasePath())
    const identityColumns = [
      ['challenges', 'id'],
      ['habits', 'id'],
      ['habit_metrics', 'id'],
      ['check_ins', 'id'],
      ['sync_devices', 'device_id'],
    ] as const

    for (const [table, column] of identityColumns) {
      const definition = database
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .find((row) => (row as { name: string }).name === column) as { notnull: number }
      expect(definition.notnull, `${table}.${column}`).toBe(1)
    }

    database.close()
  })

  test('rejects a database created by a newer binary', () => {
    const file = databasePath()
    const database = openDatabase(file)
    database
      .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(99, 'future schema', '2026-08-09T00:00:00.000Z')
    database.close()

    expect(() => openDatabase(file)).toThrow(/newer schema version 99/i)
  })

  test(
    'serializes concurrent first opens without replaying migrations',
    async () => {
      const file = databasePath()
      const moduleUrl = pathToFileURL(path.resolve(import.meta.dirname, 'database.ts')).href
      const script = `
        import { openDatabase } from ${JSON.stringify(moduleUrl)};
        const database = openDatabase(process.argv[1]);
        database.close();
      `
      const results = await Promise.allSettled(
        Array.from({ length: 24 }, () =>
          execFileAsync(
            process.execPath,
            ['--import', 'tsx', '--input-type=module', '--eval', script, file],
            { cwd: path.resolve(import.meta.dirname, '..') },
          ),
        ),
      )
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => String(result.reason))

      expect(failures).toEqual([])
      const database = openDatabase(file)
      expect(database.prepare('SELECT version FROM schema_migrations').pluck().all()).toEqual([1])
      database.close()
    },
    30_000,
  )

  test('reopens an existing database without replaying migrations', () => {
    const file = databasePath()
    openDatabase(file).close()
    const database = openDatabase(file)

    expect(database.prepare('SELECT COUNT(*) FROM schema_migrations').pluck().get()).toBe(1)

    database.close()
  })
})
