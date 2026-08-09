import { describe, expect, test } from 'vitest'
import type { AppState } from '@/lib/types'
import { fromDisplayWeight, toDisplayWeight } from '../lib/utils'
import { materializeState } from './materialize-state'
import { normalizeState } from './normalize-state'

const fallback: AppState = {
  onboarded: false,
  profile: { name: '' },
  challenge: { startDate: '2026-01-01', totalDays: 75 },
  habits: [],
  settings: { unit: 'lb' },
  days: {},
  reflections: {},
  progress: [],
}

const state: AppState = {
  onboarded: true,
  profile: {
    name: 'Erica',
    age: 30,
    heightFeet: 5,
    heightInches: 4,
    startWeight: fromDisplayWeight(68.5, 'kg'),
    goalWeight: fromDisplayWeight(63.5, 'kg'),
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
  settings: { unit: 'kg' },
  days: {
    '2026-08-09': {
      habits: { walk: true },
      metrics: { walk: 60 },
      journal: { win: 'Started', gratitude: 'Home', feeling: 'Good', notes: '' },
    },
  },
  reflections: { 0: { energy: 4, mood: 5, win: 'Started', intention: 'Continue' } },
  progress: [
    {
      id: 'check-in-1',
      date: '2026-08-09',
      weight: fromDisplayWeight(68.5, 'kg'),
      mood: 5,
      energy: 4,
      notes: 'Baseline',
    },
  ],
}

describe('materializeState', () => {
  test('rebuilds the live workspace from synchronized relational records', () => {
    const records = normalizeState(state, '2026-08-09T00:00:00.000Z')
    const workspace = materializeState(records, fallback)
    const habitId = workspace.habits[0]!.id

    expect(workspace).toEqual(
      expect.objectContaining({
        onboarded: true,
        settings: expect.objectContaining({ unit: 'kg' }),
        profile: expect.objectContaining({
          name: 'Erica',
          heightFeet: 5,
          heightInches: 4,
        }),
        challenge: expect.objectContaining({ startDate: '2026-08-09', totalDays: 75 }),
      }),
    )
    expect(toDisplayWeight(workspace.profile.startWeight, 'kg')).toBeCloseTo(68.5, 1)
    expect(toDisplayWeight(workspace.profile.goalWeight, 'kg')).toBeCloseTo(63.5, 1)
    expect(workspace.days['2026-08-09']).toEqual(
      expect.objectContaining({
        habits: { [habitId]: true },
        metrics: { [habitId]: 60 },
        journal: state.days['2026-08-09']!.journal,
      }),
    )
    expect(workspace.reflections[0]).toEqual(state.reflections[0])
    expect(toDisplayWeight(workspace.progress[0]?.weight, 'kg')).toBeCloseTo(68.5, 1)
  })

  test('excludes tombstoned records and their dependent entries', () => {
    const records = normalizeState(state, '2026-08-09T00:00:00.000Z').map((entity) =>
      entity.entityType === 'habit'
        ? { ...entity, record: { ...entity.record, deletedAt: '2026-08-10T00:00:00.000Z' } }
        : entity,
    )

    const workspace = materializeState(records, fallback)

    expect(workspace.habits).toEqual([])
    expect(workspace.days['2026-08-09']?.habits).toEqual({})
    expect(workspace.days['2026-08-09']?.metrics).toEqual({})
  })

  test('is a fixed point after synchronized records are materialized', () => {
    const first = normalizeState(state, '2026-08-09T00:00:00.000Z')
    const materialized = materializeState(first, state)
    const second = normalizeState(materialized, '2026-08-10T12:34:56.000Z')

    expect(second).toEqual(first)
  })

  test('returns to onboarding when the synchronized challenge is deleted', () => {
    const records = normalizeState(state, '2026-08-09T00:00:00.000Z').map((entity) =>
      entity.entityType === 'challenge'
        ? { ...entity, record: { ...entity.record, deletedAt: '2026-08-10T00:00:00.000Z' } }
        : entity,
    )

    const workspace = materializeState(records, state)

    expect(workspace.onboarded).toBe(false)
    expect(workspace.challenge.id).not.toBe(state.challenge.id)
    expect(workspace.habits).toEqual([])
    expect(workspace.days).toEqual({})
  })
})
