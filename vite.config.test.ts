import { describe, expect, test } from 'vitest'
import { navigateFallbackDenylist } from './vite.config'

function denied(path: string): boolean {
  return navigateFallbackDenylist.some((pattern) => pattern.test(path))
}

describe('service worker navigation fallback', () => {
  test.each([
    '/api',
    '/api?full=1',
    '/api/sync',
    '/healthz',
    '/healthz/',
    '/healthz?full=1',
    '/healthz/missing',
  ])('never serves the SPA shell for %s', (path) => {
    expect(denied(path)).toBe(true)
  })

  test.each(['/', '/journal', '/progress?week=2'])('keeps the SPA fallback for %s', (path) => {
    expect(denied(path)).toBe(false)
  })
})
