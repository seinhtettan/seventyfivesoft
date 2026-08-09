import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { createApplication } from './app'
import { openDatabase } from './database'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'seventyfivesoft-app-'))
  temporaryDirectories.push(directory)
  const staticRoot = path.join(directory, 'dist')
  mkdirSync(staticRoot)
  const database = openDatabase(path.join(directory, 'application.sqlite'))
  return { directory, staticRoot, database }
}

describe('createApplication', () => {
  test('serves the API through the production application', async () => {
    const { database, staticRoot } = fixture()
    const app = createApplication(database, { staticRoot })

    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok', cursor: 0 })
    database.close()
  })

  test('serves versioned assets with immutable caching', async () => {
    const { database, staticRoot } = fixture()
    const fs = await import('node:fs/promises')
    await fs.mkdir(path.join(staticRoot, 'assets'))
    await fs.writeFile(path.join(staticRoot, 'assets', 'app-abc123.js'), 'export {}')
    const app = createApplication(database, { staticRoot })

    const response = await app.request('/assets/app-abc123.js')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    database.close()
  })

  test('returns a non-cacheable 404 for missing versioned assets', async () => {
    const { database, staticRoot } = fixture()
    const fs = await import('node:fs/promises')
    await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>75 Soft</title>')
    const app = createApplication(database, { staticRoot })

    const response = await app.request('/assets/missing.js')

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.text()).resolves.not.toContain('<title>75 Soft</title>')
    database.close()
  })

  test.each([
    ['POST', '/assets/app-abc123.js'],
    ['OPTIONS', '/assets/app-abc123.js'],
    ['DELETE', '/index.html'],
  ])('does not serve static files for %s %s', async (method, requestPath) => {
    const { database, staticRoot } = fixture()
    const fs = await import('node:fs/promises')
    await fs.mkdir(path.join(staticRoot, 'assets'))
    await fs.writeFile(path.join(staticRoot, 'assets', 'app-abc123.js'), 'export {}')
    await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>75 Soft</title>')
    const app = createApplication(database, { staticRoot })

    const response = await app.request(requestPath, { method })

    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain(method === 'DELETE' ? '<title>75 Soft</title>' : 'export {}')
    database.close()
  })

  test('compresses eligible static assets when the client supports gzip', async () => {
    const { database, staticRoot } = fixture()
    const fs = await import('node:fs/promises')
    await fs.mkdir(path.join(staticRoot, 'assets'))
    await fs.writeFile(path.join(staticRoot, 'assets', 'app-abc123.js'), 'const value = 1;\n'.repeat(256))
    const app = createApplication(database, { staticRoot })

    const response = await app.request('/assets/app-abc123.js', {
      headers: { 'accept-encoding': 'gzip' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-encoding')).toBe('gzip')
    expect(response.headers.get('vary')).toContain('Accept-Encoding')
    database.close()
  })

  test('serves the SPA shell for client-side routes', async () => {
    const { database, staticRoot } = fixture()
    const fs = await import('node:fs/promises')
    await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>75 Soft</title>')
    const app = createApplication(database, { staticRoot })

    const response = await app.request('/journal')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(await response.text()).toContain('<title>75 Soft</title>')
    database.close()
  })

  test.each(['/api', '/healthz/missing'])('does not turn %s into the SPA shell', async (requestPath) => {
    const { database, staticRoot } = fixture()
    const fs = await import('node:fs/promises')
    await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html>')
    const app = createApplication(database, { staticRoot })

    const response = await app.request(requestPath)

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    database.close()
  })

  test('does not turn unknown API routes into the SPA shell', async () => {
    const { database, staticRoot } = fixture()
    const fs = await import('node:fs/promises')
    await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html>')
    const app = createApplication(database, { staticRoot })

    const response = await app.request('/api/missing')

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    database.close()
  })
})
