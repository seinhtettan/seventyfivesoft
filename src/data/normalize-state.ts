import type { AppState } from '@/lib/types'
import type { EntityType, SyncRecord } from '@/lib/sync'

export interface NormalizedEntity {
  entityType: EntityType
  entityId: string
  record: SyncRecord
}

const gramsPerPound = 453.59237

function weightGrams(pounds: number | undefined): number | null {
  return pounds === undefined ? null : Math.round(pounds * gramsPerPound)
}

function heightCentimeters(feet: number | undefined, inches: number | undefined): number | null {
  if (feet === undefined && inches === undefined) return null
  return Number((((feet ?? 0) * 12 + (inches ?? 0)) * 2.54).toFixed(2))
}

function createdAtForDate(date: string): string {
  return `${date}T00:00:00.000Z`
}

export function normalizeState(state: AppState, _createdAt: string): NormalizedEntity[] {
  if (!state.onboarded) return []

  const challengeId = state.challenge.id ?? `challenge:${state.challenge.startDate}`
  const challengeCreatedAt = createdAtForDate(state.challenge.startDate)
  const habitIds = new Map(state.habits.map((habit) => [habit.id, habit.id]))
  const metricIds = new Map(
    state.habits
      .filter((habit) => habit.metric !== undefined)
      .map((habit) => [habit.id, habit.metric?.id ?? `${habit.id}:metric`]),
  )
  const entities: NormalizedEntity[] = [
    {
      entityType: 'profile',
      entityId: 'profile',
      record: {
        id: 1,
        displayName: state.profile.name,
        age: state.profile.age ?? null,
        heightCm: heightCentimeters(state.profile.heightFeet, state.profile.heightInches),
      },
    },
    {
      entityType: 'preferences',
      entityId: 'preferences',
      record: {
        id: 1,
        weightUnit: state.settings.unit,
        timezone: state.settings.timezone ?? 'UTC',
      },
    },
    {
      entityType: 'challenge',
      entityId: challengeId,
      record: {
        id: challengeId,
        title: '75 Soft',
        startDate: state.challenge.startDate,
        durationDays: state.challenge.totalDays,
        startWeightGrams: weightGrams(state.profile.startWeight),
        goalWeightGrams: weightGrams(state.profile.goalWeight),
        status: state.onboarded ? 'active' : 'draft',
        createdAt: challengeCreatedAt,
        deletedAt: null,
      },
    },
  ]

  state.habits.forEach((habit, sortOrder) => {
    const habitId = habitIds.get(habit.id)!
    entities.push({
      entityType: 'habit',
      entityId: habitId,
      record: {
        id: habitId,
        challengeId,
        name: habit.name,
        hint: habit.hint ?? null,
        icon: habit.icon,
        cadence: habit.cadence,
        weeklyTarget: habit.weeklyTarget ?? null,
        weeklyBonus: habit.weeklyBonus ?? null,
        sortOrder,
        activeFrom: state.challenge.startDate,
        activeUntil: null,
        createdAt: challengeCreatedAt,
        deletedAt: null,
      },
    })
    if (habit.metric !== undefined) {
      const metricId = metricIds.get(habit.id)!
      entities.push({
        entityType: 'habitMetric',
        entityId: metricId,
        record: {
          id: metricId,
          challengeId,
          habitId,
          label: habit.metric.label,
          unit: habit.metric.unit,
          target: habit.metric.target ?? null,
          step: habit.metric.step,
          minimum: habit.metric.min,
          maximum: habit.metric.max,
          sortOrder: 0,
          createdAt: challengeCreatedAt,
          deletedAt: null,
        },
      })
    }
  })

  for (const [entryDate, day] of Object.entries(state.days)) {
    for (const [legacyHabitId, completed] of Object.entries(day.habits)) {
      const habitId = habitIds.get(legacyHabitId)
      if (habitId === undefined) continue
      entities.push({
        entityType: 'habitEntry',
        entityId: `${challengeId}/${habitId}/${entryDate}`,
        record: { challengeId, habitId, entryDate, completed, deletedAt: null },
      })
    }
    for (const [legacyHabitId, value] of Object.entries(day.metrics)) {
      const metricId = metricIds.get(legacyHabitId)
      if (metricId === undefined) continue
      entities.push({
        entityType: 'metricEntry',
        entityId: `${challengeId}/${metricId}/${entryDate}`,
        record: { challengeId, metricId, entryDate, value, deletedAt: null },
      })
    }
    if (day.journal !== undefined) {
      entities.push({
        entityType: 'journal',
        entityId: `${challengeId}/${entryDate}`,
        record: {
          challengeId,
          entryDate,
          win: day.journal.win,
          gratitude: day.journal.gratitude,
          feeling: day.journal.feeling,
          notes: day.journal.notes,
          deletedAt: null,
        },
      })
    }
  }

  for (const [week, reflection] of Object.entries(state.reflections)) {
    const weekIndex = Number(week)
    entities.push({
      entityType: 'weeklyReflection',
      entityId: `${challengeId}/${weekIndex}`,
      record: {
        challengeId,
        weekIndex,
        energy: reflection.energy ?? null,
        mood: reflection.mood ?? null,
        win: reflection.win,
        intention: reflection.intention,
        deletedAt: null,
      },
    })
  }

  for (const checkIn of state.progress) {
    entities.push({
      entityType: 'checkIn',
      entityId: checkIn.id,
      record: {
        id: checkIn.id,
        challengeId,
        entryDate: checkIn.date,
        weightGrams: weightGrams(checkIn.weight),
        mood: checkIn.mood ?? null,
        energy: checkIn.energy ?? null,
        notes: checkIn.notes ?? null,
        createdAt: createdAtForDate(checkIn.date),
        deletedAt: null,
      },
    })
  }

  return entities
}
