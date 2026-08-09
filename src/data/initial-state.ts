import { CHALLENGE_LENGTH, defaultHabits } from '../lib/defaults'
import { todayKey } from '../lib/date'
import type { AppState } from '../lib/types'

export function createInitialState(): AppState {
  return {
    onboarded: false,
    profile: { name: '' },
    challenge: {
      id: crypto.randomUUID(),
      startDate: todayKey(),
      totalDays: CHALLENGE_LENGTH,
    },
    habits: defaultHabits.map((habit) => ({
      ...habit,
      ...(habit.metric === undefined ? {} : { metric: { ...habit.metric } }),
    })),
    settings: { unit: 'lb' },
    days: {},
    reflections: {},
    progress: [],
  }
}
