export type Cadence = 'daily' | 'weekly'

export type WeightUnit = 'lb' | 'kg'

/** Optional soft number logged alongside a habit (hours slept, minutes walked…) */
export interface HabitMetric {
  label: string
  unit: string
  target?: number
  step: number
  min: number
  max: number
}

export interface Habit {
  id: string
  name: string
  hint?: string
  /** key of `habitIcons` */
  icon: string
  cadence: Cadence
  /** weekly habits only — sessions that count as "done" */
  weeklyTarget?: number
  /** weekly habits only — sessions beyond target shown as bonus */
  weeklyBonus?: number
  metric?: HabitMetric
}

export interface Journal {
  win: string
  gratitude: string
  feeling: string
  notes: string
}

export interface DayRecord {
  /** habitId -> completed */
  habits: Record<string, boolean>
  /** habitId -> logged number */
  metrics: Record<string, number>
  journal?: Journal
}

export interface WeeklyReflection {
  energy?: number
  mood?: number
  win: string
  intention: string
}

export interface ProgressEntry {
  id: string
  /** yyyy-MM-dd */
  date: string
  weight?: number
  mood?: number
  energy?: number
  notes?: string
}

export interface Profile {
  name: string
  age?: number
  heightFeet?: number
  heightInches?: number
  startWeight?: number
  goalWeight?: number
}

export interface Challenge {
  /** yyyy-MM-dd */
  startDate: string
  /** total days, inclusive of start & end */
  totalDays: number
}

export interface Settings {
  unit: WeightUnit
}

export interface AppState {
  onboarded: boolean
  profile: Profile
  challenge: Challenge
  habits: Habit[]
  settings: Settings
  /** yyyy-MM-dd -> record */
  days: Record<string, DayRecord>
  /** week index (0-based) -> reflection */
  reflections: Record<number, WeeklyReflection>
  progress: ProgressEntry[]
}
