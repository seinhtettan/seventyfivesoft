import { describe, expect, test, vi } from 'vitest'
import { bootstrapOfflineClient } from './bootstrap'

describe('bootstrapOfflineClient', () => {
  test('waits for hydration and the initial pull before rendering the interactive app', async () => {
    const events: string[] = []
    let hydrated = false
    let hydrationListener: () => void = () => undefined
    const bootstrap = bootstrapOfflineClient({
      isHydrated: () => hydrated,
      subscribeHydration: (listener) => {
        hydrationListener = listener
        return () => {
          hydrationListener = () => undefined
        }
      },
      subscribeEntities: () => events.push('subscribed'),
      synchronize: async () => {
        events.push('sync-started')
        await Promise.resolve()
        events.push('sync-finished')
      },
      render: () => events.push('rendered'),
    })

    await Promise.resolve()
    expect(events).toEqual([])
    hydrated = true
    hydrationListener()
    await bootstrap

    expect(events).toEqual(['subscribed', 'sync-started', 'sync-finished', 'rendered'])
  })

  test('renders after a failed initial synchronization attempt', async () => {
    const render = vi.fn()

    await expect(
      bootstrapOfflineClient({
        isHydrated: () => true,
        subscribeHydration: () => () => undefined,
        subscribeEntities: vi.fn(),
        synchronize: async () => {
          throw new TypeError('offline')
        },
        render,
      }),
    ).rejects.toThrow('offline')

    expect(render).toHaveBeenCalledOnce()
  })
})
