import path from 'node:path'
import { serve } from '@hono/node-server'
import { createApplication } from './app'
import { openDatabase } from './database'

const port = Number(process.env.PORT ?? 8080)
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be a valid TCP port.')

const databasePath = process.env.DATABASE_PATH ?? path.resolve('.data/seventyfivesoft.sqlite')
const staticRoot = process.env.STATIC_ROOT ?? path.resolve('dist')
const database = openDatabase(databasePath)
const application = createApplication(database, { staticRoot })
const server = serve({
  fetch: application.fetch,
  hostname: '0.0.0.0',
  port,
})

console.log(`75 Soft is listening on http://0.0.0.0:${port}`)

function shutdown(signal: string): void {
  console.log(`Received ${signal}; shutting down.`)
  server.close(() => {
    database.close()
    process.exit(0)
  })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
