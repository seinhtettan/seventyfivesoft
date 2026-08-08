import type { AppState, DayRecord, Habit } from './types'
import { allDayKeys, todayKey, weekDayKeys } from './date'

export const dailyHabits = (habits: Habit[]) => habits.filter((h) => h.cadence === 'daily')
export const weeklyHabits = (habits: Habit[]) => habits.filter((h) => h.cadence === 'weekly')

const noDay: DayRecord = { habits: {}, metrics: {} }

export function getDay(days: AppState['days'], key: string): DayRecord {
  return days[key] ?? noDay
}

function completedCount(day: DayRecord, habits: Habit[]): number {
  return dailyHabits(habits).reduce((n, h) => n + (day.habits[h.id] ? 1 : 0), 0)
}

/** 0–1 completion of the *daily* habits for a date. Weekly habits sit outside this. */
export function dayCompletion(days: AppState['days'], habits: Habit[], key: string): number {
  const total = dailyHabits(habits).length
  if (total === 0) return 0
  return completedCount(getDay(days, key), habits) / total
}

/** Sessions logged for a weekly habit inside a challenge week. */
export function weeklySessions(state: AppState, habitId: string, week: number): number {
  return weekDayKeys(state.challenge.startDate, state.challenge.totalDays, week).reduce(
    (n, key) => n + (getDay(state.days, key).habits[habitId] ? 1 : 0),
    0,
  )
}

export interface WeekStats {
  keys: string[]
  /** average daily-habit completion across days that have already happened */
  completion: number
  /** per habit: how many days completed this week */
  perHabit: Record<string, number>
  /** per metric habit: average of logged values (undefined when nothing logged) */
  perMetricAvg: Record<string, number | undefined>
  elapsedDays: number
  perfectDays: number
}

export function weekStats(state: AppState, week: number): WeekStats {
  const keys = weekDayKeys(state.challenge.startDate, state.challenge.totalDays, week)
  const t = todayKey()
  const elapsed = keys.filter((k) => k <= t)
  const daily = dailyHabits(state.habits)

  const perHabit: Record<string, number> = {}
  const metricTotals: Record<string, { sum: number; n: number }> = {}
  let pctSum = 0
  let perfect = 0

  for (const key of keys) {
    const day = getDay(state.days, key)
    for (const h of state.habits) {
      if (day.habits[h.id]) perHabit[h.id] = (perHabit[h.id] ?? 0) + 1
      const v = day.metrics[h.id]
      if (h.metric && typeof v === 'number' && v > 0) {
        const t0 = metricTotals[h.id] ?? { sum: 0, n: 0 }
        metricTotals[h.id] = { sum: t0.sum + v, n: t0.n + 1 }
      }
    }
    if (key <= t) {
      const pct = daily.length ? completedCount(day, state.habits) / daily.length : 0
      pctSum += pct
      if (pct >= 1) perfect += 1
    }
  }

  const perMetricAvg: Record<string, number | undefined> = {}
  for (const [id, { sum, n }] of Object.entries(metricTotals)) {
    perMetricAvg[id] = n ? sum / n : undefined
  }

  return {
    keys,
    completion: elapsed.length ? pctSum / elapsed.length : 0,
    perHabit,
    perMetricAvg,
    elapsedDays: elapsed.length,
    perfectDays: perfect,
  }
}

/** Consecutive complete days ending today (or yesterday, if today is still in progress). */
export function currentStreak(state: AppState): number {
  const keys = allDayKeys(state.challenge.startDate, state.challenge.totalDays)
  const t = todayKey()
  const past = keys.filter((k) => k <= t)
  let streak = 0
  for (let i = past.length - 1; i >= 0; i--) {
    const key = past[i]
    const pct = dayCompletion(state.days, state.habits, key)
    if (pct >= 1) {
      streak += 1
    } else if (key === t) {
      // today is still open — it doesn't end anything
      continue
    } else {
      break
    }
  }
  return streak
}

/** Per-habit streak of consecutive days completed, ending today or yesterday. */
export function habitStreak(state: AppState, habitId: string): number {
  const keys = allDayKeys(state.challenge.startDate, state.challenge.totalDays)
  const t = todayKey()
  const past = keys.filter((k) => k <= t)
  let streak = 0
  for (let i = past.length - 1; i >= 0; i--) {
    const key = past[i]
    if (getDay(state.days, key).habits[habitId]) streak += 1
    else if (key === t) continue
    else break
  }
  return streak
}

export interface OverallStats {
  elapsedDays: number
  completeDays: number
  partialDays: number
  averageCompletion: number
  totalChecks: number
}

export function overallStats(state: AppState): OverallStats {
  const keys = allDayKeys(state.challenge.startDate, state.challenge.totalDays)
  const t = todayKey()
  let complete = 0
  let partial = 0
  let sum = 0
  let elapsed = 0
  let checks = 0

  for (const key of keys) {
    if (key > t) continue
    elapsed += 1
    const pct = dayCompletion(state.days, state.habits, key)
    sum += pct
    if (pct >= 1) complete += 1
    else if (pct > 0) partial += 1
    const day = getDay(state.days, key)
    checks += Object.values(day.habits).filter(Boolean).length
  }

  return {
    elapsedDays: elapsed,
    completeDays: complete,
    partialDays: partial,
    averageCompletion: elapsed ? sum / elapsed : 0,
    totalChecks: checks,
  }
}
