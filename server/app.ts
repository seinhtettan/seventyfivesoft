import path from 'node:path'
import { readFile } from 'node:fs/promises'
import type Database from 'better-sqlite3'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { handleApiRequest } from './http'

interface ApplicationOptions {
  staticRoot?: string
}

export function createApplication(
  database: Database.Database,
  options: ApplicationOptions = {},
): Hono {
  const staticRoot = path.resolve(options.staticRoot ?? 'dist')
  const application = new Hono()
  const staticFiles = serveStatic({ root: staticRoot })

  application.use('*', async (context, next) => {
    await next()
    const pathname = new URL(context.req.url).pathname
    if (pathname.startsWith('/assets/')) {
      context.header(
        'cache-control',
        context.res.status < 400 ? 'public, max-age=31536000, immutable' : 'no-store',
      )
    } else if (
      pathname === '/' ||
      pathname === '/index.html' ||
      pathname === '/sw.js' ||
      pathname === '/registerSW.js' ||
      pathname === '/manifest.webmanifest'
    ) {
      context.header('cache-control', 'no-cache')
    }
  })
  application.use('*', compress())

  application.all('/api/*', (context) => handleApiRequest(database, context.req.raw))
  application.all('/healthz', (context) => handleApiRequest(database, context.req.raw))
  application.all('/healthz/*', (context) => handleApiRequest(database, context.req.raw))
  application.on(['GET', 'HEAD'], '/assets', staticFiles)
  application.on(['GET', 'HEAD'], '/assets/*', staticFiles)
  application.all('/assets', (context) => {
    context.header('cache-control', 'no-store')
    return context.json({ message: 'Not found.' }, 404)
  })
  application.all('/assets/*', (context) => {
    context.header('cache-control', 'no-store')
    return context.json({ message: 'Not found.' }, 404)
  })
  application.on(['GET', 'HEAD'], '*', staticFiles)
  application.get('*', async (context) => {
    const shell = await readFile(path.join(staticRoot, 'index.html'), 'utf8')
    context.header('cache-control', 'no-cache')
    return context.html(shell)
  })

  return application
}
