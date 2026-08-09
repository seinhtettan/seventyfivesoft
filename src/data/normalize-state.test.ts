import { describe, expect, test } from 'vitest'
import type { AppState } from '@/lib/types'
import { fromDisplayWeight } from '../lib/utils'
import { normalizeState } from './normalize-state'

const state: AppState = {
  onboarded: true,
  profile: {
    name: 'Erica',
    age: 30,
    heightFeet: 5,
    heightInches: 4,
    startWeight: 150,
    goalWeight: 140,
  },
  challenge: { startDate: '2026-08-09', totalDays: 75 },
  habits: [
    {
      id: 'walk',
      name: 'Walk',
      icon: 'walk',
      cadence: 'daily',
      metric: { label: 'Minutes', unit: 'min', target: 60, step: 5, min: 0, max: 240 },
    },
  ],
  settings: { unit: 'lb' },
  days: {
    '2026-08-09': {
      habits: { walk: true },
      metrics: { walk: 60 },
      journal: { win: 'Started', gratitude: '', feeling: 'Good', notes: '' },
    },
  },
  reflections: {
    0: { energy: 4, mood: 5, win: 'Started', intention: 'Continue' },
  },
  progress: [
    {
      id: 'check-in-1',
      date: '2026-08-09',
      weight: 150,
      mood: 5,
      energy: 4,
      notes: 'Baseline',
    },
  ],
}

describe('normalizeState', () => {
  test('maps the local Zustand state to stable relational records', () => {
    const entities = normalizeState(state, '2026-08-09T00:00:00.000Z')
    const byType = (type: string) => entities.filter((entity) => entity.entityType === type)

    expect(byType('profile')).toEqual([
      expect.objectContaining({
        entityId: 'profile',
        record: expect.objectContaining({ displayName: 'Erica', heightCm: 162.56 }),
      }),
    ])
    expect(byType('challenge')).toEqual([
      expect.objectContaining({
        entityId: 'challenge:2026-08-09',
        record: expect.objectContaining({
          durationDays: 75,
          startWeightGrams: 68039,
          goalWeightGrams: 63503,
        }),
      }),
    ])
    expect(byType('habit')).toHaveLength(1)
    expect(byType('habitMetric')).toHaveLength(1)
    expect(byType('habitEntry')).toHaveLength(1)
    expect(byType('metricEntry')).toHaveLength(1)
    expect(byType('journal')).toHaveLength(1)
    expect(byType('weeklyReflection')).toHaveLength(1)
    expect(byType('checkIn')).toEqual([
      expect.objectContaining({ record: expect.objectContaining({ weightGrams: 68039 }) }),
    ])
  })

  test('uses the configured weight unit during migration', () => {
    const kilogramState: AppState = {
      ...state,
      settings: { unit: 'kg' },
      profile: {
        ...state.profile,
        startWeight: fromDisplayWeight(68.5, 'kg'),
        goalWeight: fromDisplayWeight(63.5, 'kg'),
      },
      progress: [{ ...state.progress[0]!, weight: fromDisplayWeight(68.5, 'kg') }],
    }

    const entities = normalizeState(kilogramState, '2026-08-09T00:00:00.000Z')
    const challenge = entities.find((entity) => entity.entityType === 'challenge')
    const checkIn = entities.find((entity) => entity.entityType === 'checkIn')

    expect(challenge?.record).toEqual(
      expect.objectContaining({ startWeightGrams: 68_500, goalWeightGrams: 63_500 }),
    )
    expect(checkIn?.record).toEqual(expect.objectContaining({ weightGrams: 68_500 }))
  })

  test('normalizes a missing legacy timezone deterministically', () => {
    const legacy = normalizeState(state, '2026-08-09T00:00:00.000Z')
    const configured = normalizeState(
      { ...state, settings: { unit: 'lb', timezone: 'Asia/Singapore' } },
      '2026-08-09T00:00:00.000Z',
    )

    expect(legacy.find((entity) => entity.entityType === 'preferences')?.record.timezone).toBe('UTC')
    expect(configured.find((entity) => entity.entityType === 'preferences')?.record.timezone).toBe(
      'Asia/Singapore',
    )
  })

  test('keeps challenge identity stable when its start date changes', () => {
    const identified: AppState = {
      ...state,
      challenge: { ...state.challenge, id: 'challenge-stable' },
    }

    const before = normalizeState(identified, '2026-08-09T00:00:00.000Z')
    const after = normalizeState(
      { ...identified, challenge: { ...identified.challenge, startDate: '2026-08-16' } },
      '2026-08-10T00:00:00.000Z',
    )

    expect(before.find((entity) => entity.entityType === 'challenge')?.entityId).toBe(
      'challenge-stable',
    )
    expect(after.find((entity) => entity.entityType === 'challenge')?.entityId).toBe(
      'challenge-stable',
    )
  })
})
