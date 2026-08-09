import type Database from 'better-sqlite3'
import { ZodError } from 'zod'
import { parseSyncRequest } from '../src/lib/sync'
import { SyncProtocolError, synchronize } from './sync'

const maximumJsonBytes = 1_000_000

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > maximumJsonBytes) throw new PayloadTooLargeError()
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maximumJsonBytes) throw new PayloadTooLargeError()
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new MalformedJsonError()
  }
}

class MalformedJsonError extends Error {}
class PayloadTooLargeError extends Error {}

function hasSqliteCode(error: unknown, code: string): error is Error & { code: string } {
  return error instanceof Error && 'code' in error && error.code === code
}

export async function handleApiRequest(
  database: Database.Database,
  request: Request,
): Promise<Response> {
  const { pathname } = new URL(request.url)

  if (pathname === '/api/health' || pathname === '/healthz') {
    if (request.method !== 'GET') return json({ message: 'Method not allowed.' }, 405)
    const cursor = Number(database.prepare('SELECT COALESCE(MAX(sequence), 0) FROM sync_changes').pluck().get())
    return json({ status: 'ok', cursor })
  }

  if (pathname === '/api/sync') {
    if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405)
    try {
      const syncRequest = parseSyncRequest(await readJson(request))
      return json(synchronize(database, syncRequest))
    } catch (error) {
      if (error instanceof MalformedJsonError) return json({ message: 'Request body must be valid JSON.' }, 400)
      if (error instanceof PayloadTooLargeError) return json({ message: 'Request payload is too large.' }, 413)
      if (hasSqliteCode(error, 'SQLITE_CONSTRAINT_FOREIGNKEY')) {
        return json(
          {
            message: 'Mutation references a related record that does not exist.',
            code: 'related_record_missing',
          },
          422,
        )
      }
      if (hasSqliteCode(error, 'SQLITE_CONSTRAINT_CHECK')) {
        return json(
          {
            message: 'Mutation violates a record constraint.',
            code: 'record_constraint_failed',
          },
          422,
        )
      }
      if (error instanceof SyncProtocolError) {
        return json({ message: error.message, code: error.code }, error.status)
      }
      if (error instanceof ZodError) {
        return json({ message: 'Sync request is invalid.', issues: error.issues }, 422)
      }
      throw error
    }
  }

  return json({ message: 'Not found.' }, 404)
}
