import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  AppState,
  DayRecord,
  Habit,
  Journal,
  ProgressEntry,
  Profile,
  Settings,
  WeeklyReflection,
} from '@/lib/types'
import { appStateStorage } from '@/data/runtime'
import { createInitialState } from '@/data/initial-state'
import { mergePersistedState, withChallengeIdentity } from '@/data/merge-state'

const emptyDay = (): DayRecord => ({ habits: {}, metrics: {} })
let markHydratedAfterRestore: (() => void) | undefined
const initialState = createInitialState()

interface Actions {
  hydrated: boolean
  setHydrated: (hydrated: boolean) => void
  finishOnboarding: (payload: {
    profile: Profile
    challenge: AppState['challenge']
    habits: Habit[]
    unit: Settings['unit']
  }) => void
  toggleHabit: (dateKey: string, habitId: string) => void
  /** Nudge a metric relative to its stored value, so fast repeated taps all land. */
  adjustMetric: (
    dateKey: string,
    habitId: string,
    delta: number,
    min: number,
    max: number,
  ) => void
  setJournal: (dateKey: string, patch: Partial<Journal>) => void
  setReflection: (week: number, patch: Partial<WeeklyReflection>) => void
  addProgress: (entry: Omit<ProgressEntry, 'id'>) => void
  removeProgress: (id: string) => void
  updateProfile: (patch: Partial<Profile>) => void
  updateChallenge: (patch: Partial<AppState['challenge']>) => void
  setHabits: (habits: Habit[]) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetAll: () => void
  importState: (state: Partial<AppState>) => void
}

export type AppStore = AppState & Actions

export const useApp = create<AppStore>()(
  persist<AppStore, [], [], AppState>(
    (set) => ({
      ...initialState,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),

      finishOnboarding: ({ profile, challenge, habits, unit }) =>
        set((s) => ({
          onboarded: true,
          profile,
          challenge: { ...challenge, id: s.challenge.id ?? crypto.randomUUID() },
          habits,
          settings: { ...s.settings, unit },
        })),

      toggleHabit: (dateKey, habitId) =>
        set((s) => {
          const day = s.days[dateKey] ?? emptyDay()
          return {
            days: {
              ...s.days,
              [dateKey]: {
                ...day,
                habits: { ...day.habits, [habitId]: !day.habits[habitId] },
              },
            },
          }
        }),

      adjustMetric: (dateKey, habitId, delta, min, max) =>
        set((s) => {
          const day = s.days[dateKey] ?? emptyDay()
          const current = day.metrics[habitId] ?? 0
          const next = Math.min(max, Math.max(min, Number((current + delta).toFixed(2))))
          return {
            days: {
              ...s.days,
              [dateKey]: { ...day, metrics: { ...day.metrics, [habitId]: next } },
            },
          }
        }),

      setJournal: (dateKey, patch) =>
        set((s) => {
          const day = s.days[dateKey] ?? emptyDay()
          const journal: Journal = {
            win: '',
            gratitude: '',
            feeling: '',
            notes: '',
            ...day.journal,
            ...patch,
          }
          return { days: { ...s.days, [dateKey]: { ...day, journal } } }
        }),

      setReflection: (week, patch) =>
        set((s) => {
          const current = s.reflections[week] ?? { win: '', intention: '' }
          return { reflections: { ...s.reflections, [week]: { ...current, ...patch } } }
        }),

      addProgress: (entry) =>
        set((s) => ({
          progress: [...s.progress, { ...entry, id: crypto.randomUUID() }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        })),

      removeProgress: (id) => set((s) => ({ progress: s.progress.filter((p) => p.id !== id) })),

      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      updateChallenge: (patch) => set((s) => ({ challenge: { ...s.challenge, ...patch } })),

      setHabits: (habits) => set({ habits }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      resetAll: () => set(createInitialState()),

      importState: (state) =>
        set((current) => ({
          ...current,
          ...state,
          ...(state.challenge === undefined
            ? {}
            : {
                challenge: withChallengeIdentity(state.challenge),
              }),
        })),
    }),
    {
      name: '75soft:v1',
      version: 1,
      storage: createJSONStorage<AppState>(() => appStateStorage),
      partialize: (state) => ({
        onboarded: state.onboarded,
        profile: state.profile,
        challenge: state.challenge,
        habits: state.habits,
        settings: state.settings,
        days: state.days,
        reflections: state.reflections,
        progress: state.progress,
      }),
      merge: mergePersistedState,
      onRehydrateStorage: () => (state, error) => {
        if (error !== undefined) console.error('Failed to restore local application data.', error)
        if (state === undefined) markHydratedAfterRestore?.()
        else state.setHydrated(true)
      },
    },
  ),
)

markHydratedAfterRestore = () => useApp.setState({ hydrated: true })

