import type {
  AppState,
  DayRecord,
  Habit,
  HabitMetric,
  Profile,
  ProgressEntry,
  WeeklyReflection,
} from '@/lib/types'
import type { SyncRecord } from '@/lib/sync'
import type { NormalizedEntity } from './normalize-state'

const gramsPerPound = 453.59237

function isPresent(record: SyncRecord): boolean {
  return record.deletedAt === undefined || record.deletedAt === null
}

function valueFromGrams(grams: unknown): number | undefined {
  if (typeof grams !== 'number') return undefined
  return Number((grams / gramsPerPound).toFixed(6))
}

function heightFromCentimeters(centimeters: unknown): Pick<Profile, 'heightFeet' | 'heightInches'> {
  if (typeof centimeters !== 'number') return {}
  const totalInches = Math.round(centimeters / 2.54)
  return { heightFeet: Math.floor(totalInches / 12), heightInches: totalInches % 12 }
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function day(days: Record<string, DayRecord>, entryDate: string): DayRecord {
  return (days[entryDate] ??= { habits: {}, metrics: {} })
}

export function materializeState(
  entities: NormalizedEntity[],
  fallback: AppState,
): AppState {
  const active = entities.filter((entity) => isPresent(entity.record))
  const challengeEntity =
    active.find(
      (entity) => entity.entityType === 'challenge' && entity.record.status === 'active',
    ) ?? active.find((entity) => entity.entityType === 'challenge')
  if (challengeEntity === undefined) {
    return {
      ...fallback,
      onboarded: false,
      challenge: { ...fallback.challenge, id: crypto.randomUUID() },
      habits: [],
      days: {},
      reflections: {},
      progress: [],
    }
  }

  const challenge = challengeEntity.record
  const challengeId = String(challenge.id)
  const preferences = active.find((entity) => entity.entityType === 'preferences')?.record
  const unit = preferences?.weightUnit === 'kg' ? 'kg' : 'lb'
  const profileRecord = active.find((entity) => entity.entityType === 'profile')?.record
  const profile: Profile = {
    name: typeof profileRecord?.displayName === 'string' ? profileRecord.displayName : '',
    ...heightFromCentimeters(profileRecord?.heightCm),
    ...(typeof profileRecord?.age === 'number' ? { age: profileRecord.age } : {}),
    ...(valueFromGrams(challenge.startWeightGrams) === undefined
      ? {}
      : { startWeight: valueFromGrams(challenge.startWeightGrams) }),
    ...(valueFromGrams(challenge.goalWeightGrams) === undefined
      ? {}
      : { goalWeight: valueFromGrams(challenge.goalWeightGrams) }),
  }

  const metricRecords = active
    .filter(
      (entity) =>
        entity.entityType === 'habitMetric' && entity.record.challengeId === challengeId,
    )
    .sort((left, right) => Number(left.record.sortOrder) - Number(right.record.sortOrder))
  const metricByHabit = new Map(metricRecords.map((entity) => [String(entity.record.habitId), entity.record]))
  const habits: Habit[] = active
    .filter(
      (entity) => entity.entityType === 'habit' && entity.record.challengeId === challengeId,
    )
    .sort((left, right) => Number(left.record.sortOrder) - Number(right.record.sortOrder))
    .map(({ record }) => {
      const metricRecord = metricByHabit.get(String(record.id))
      const metric: HabitMetric | undefined =
        metricRecord === undefined
          ? undefined
          : {
              id: String(metricRecord.id),
              label: String(metricRecord.label),
              unit: String(metricRecord.unit),
              step: Number(metricRecord.step),
              min: Number(metricRecord.minimum),
              max: Number(metricRecord.maximum),
              ...(typeof metricRecord.target === 'number' ? { target: metricRecord.target } : {}),
            }
      return {
        id: String(record.id),
        name: String(record.name),
        icon: String(record.icon),
        cadence: record.cadence === 'weekly' ? 'weekly' : 'daily',
        ...(optionalString(record.hint) === undefined ? {} : { hint: optionalString(record.hint) }),
        ...(optionalNumber(record.weeklyTarget) === undefined
          ? {}
          : { weeklyTarget: optionalNumber(record.weeklyTarget) }),
        ...(optionalNumber(record.weeklyBonus) === undefined
          ? {}
          : { weeklyBonus: optionalNumber(record.weeklyBonus) }),
        ...(metric === undefined ? {} : { metric }),
      }
    })
  const habitIds = new Set(habits.map((habit) => habit.id))
  const metricToHabit = new Map(
    metricRecords
      .filter((entity) => habitIds.has(String(entity.record.habitId)))
      .map((entity) => [String(entity.record.id), String(entity.record.habitId)]),
  )

  const days: Record<string, DayRecord> = {}
  for (const entity of active) {
    const record = entity.record
    if (record.challengeId !== challengeId) continue
    if (entity.entityType === 'habitEntry') {
      const habitId = String(record.habitId)
      if (habitIds.has(habitId)) day(days, String(record.entryDate)).habits[habitId] = Boolean(record.completed)
    } else if (entity.entityType === 'metricEntry') {
      const habitId = metricToHabit.get(String(record.metricId))
      if (habitId !== undefined) day(days, String(record.entryDate)).metrics[habitId] = Number(record.value)
    } else if (entity.entityType === 'journal') {
      day(days, String(record.entryDate)).journal = {
        win: String(record.win),
        gratitude: String(record.gratitude),
        feeling: String(record.feeling),
        notes: String(record.notes),
      }
    }
  }

  const reflections: Record<number, WeeklyReflection> = {}
  for (const entity of active) {
    if (entity.entityType !== 'weeklyReflection' || entity.record.challengeId !== challengeId) continue
    const record = entity.record
    reflections[Number(record.weekIndex)] = {
      win: String(record.win),
      intention: String(record.intention),
      ...(optionalNumber(record.energy) === undefined ? {} : { energy: optionalNumber(record.energy) }),
      ...(optionalNumber(record.mood) === undefined ? {} : { mood: optionalNumber(record.mood) }),
    }
  }

  const progress: ProgressEntry[] = active
    .filter(
      (entity) => entity.entityType === 'checkIn' && entity.record.challengeId === challengeId,
    )
    .map(({ record }) => ({
      id: String(record.id),
      date: String(record.entryDate),
      ...(valueFromGrams(record.weightGrams) === undefined
        ? {}
        : { weight: valueFromGrams(record.weightGrams) }),
      ...(optionalNumber(record.mood) === undefined ? {} : { mood: optionalNumber(record.mood) }),
      ...(optionalNumber(record.energy) === undefined ? {} : { energy: optionalNumber(record.energy) }),
      ...(optionalString(record.notes) === undefined ? {} : { notes: optionalString(record.notes) }),
    }))
    .sort((left, right) => left.date.localeCompare(right.date))

  return {
    onboarded: challenge.status !== 'draft',
    profile,
    challenge: {
      id: challengeId,
      startDate: String(challenge.startDate),
      totalDays: Number(challenge.durationDays),
    },
    habits,
    settings: {
      unit,
      ...(typeof preferences?.timezone === 'string' ? { timezone: preferences.timezone } : {}),
    },
    days,
    reflections,
    progress,
  }
}
