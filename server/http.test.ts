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

    expect(malformed.status).toBe(400)
    expect(invalid.status).toBe(422)
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
