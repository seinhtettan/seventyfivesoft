import { describe, expect, test, vi } from 'vitest'
import { dispatchSettledValue } from './settled-value'

describe('dispatchSettledValue', () => {
  test('retries when a write begins after readiness and during the entity read', async () => {
    let revision = 0
    const dispatch = vi.fn()
    const read = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(async () => {
        revision += 1
        return 'old entities'
      })
      .mockResolvedValueOnce('new entities')

    await dispatchSettledValue(
      { ready: async () => undefined, writeRevision: () => revision },
      read,
      dispatch,
    )

    expect(read).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenCalledOnce()
    expect(dispatch).toHaveBeenCalledWith('new entities')
  })

  test('captures the revision before waiting for queued writes', async () => {
    let revision = 0
    let readyCalls = 0
    const dispatch = vi.fn()

    await dispatchSettledValue(
      {
        ready: async () => {
          readyCalls += 1
          if (readyCalls === 1) revision += 1
        },
        writeRevision: () => revision,
      },
      async () => (revision === 0 ? 'old entities' : 'new entities'),
      dispatch,
    )

    expect(readyCalls).toBe(2)
    expect(dispatch).toHaveBeenCalledOnce()
    expect(dispatch).toHaveBeenCalledWith('new entities')
  })

  test('validates and dispatches without an intervening promise boundary', async () => {
    let revision = 0
    const events: string[] = []

    await dispatchSettledValue(
      { ready: async () => undefined, writeRevision: () => revision },
      async () => 'current entities',
      (value) => {
        events.push(value)
        revision += 1
      },
    )

    expect(events).toEqual(['current entities'])
    expect(revision).toBe(1)
  })
})
