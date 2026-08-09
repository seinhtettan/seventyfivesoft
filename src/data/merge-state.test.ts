import { describe, expect, test } from 'vitest'
import type { AppState } from '../lib/types'
import { mergePersistedState, withChallengeIdentity } from './merge-state'

const current: AppState = {
  onboarded: false,
  profile: { name: '' },
  challenge: { id: 'fresh-id', startDate: '2026-08-09', totalDays: 75 },
  habits: [],
  settings: { unit: 'lb' },
  days: {},
  reflections: {},
  progress: [],
}

describe('mergePersistedState', () => {
  test('keeps the current state when a fresh browser has no persisted workspace', () => {
    expect(mergePersistedState(undefined, current)).toBe(current)
  })

  test('adds a stable challenge identity to legacy persisted state', () => {
    const legacy: AppState = {
      ...current,
      onboarded: true,
      challenge: { startDate: '2026-07-01', totalDays: 75 },
    }

    expect(mergePersistedState(legacy, current).challenge).toEqual({
      id: 'challenge:2026-07-01',
      startDate: '2026-07-01',
      totalDays: 75,
    })
  })

  test('derives the same challenge identity for every legacy import', () => {
    const legacy = { startDate: '2026-07-01', totalDays: 75 }

    expect(withChallengeIdentity(legacy).id).toBe('challenge:2026-07-01')
    expect(withChallengeIdentity({ ...legacy }).id).toBe('challenge:2026-07-01')
  })
})
