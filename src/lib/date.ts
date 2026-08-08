import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'

export const ISO = 'yyyy-MM-dd'

export function toKey(d: Date): string {
  return format(d, ISO)
}

export function fromKey(key: string): Date {
  return startOfDay(parseISO(key))
}

export function today(): Date {
  return startOfDay(new Date())
}

export function todayKey(): string {
  return toKey(today())
}

/** 1-based day number within the challenge, or null when outside the range. */
export function dayNumber(startKey: string, totalDays: number, date: Date): number | null {
  const n = differenceInCalendarDays(startOfDay(date), fromKey(startKey)) + 1
  return n >= 1 && n <= totalDays ? n : null
}

/** 1-based day number clamped into the challenge — useful for "where am I" copy. */
export function clampedDayNumber(startKey: string, totalDays: number, date: Date): number {
  const n = differenceInCalendarDays(startOfDay(date), fromKey(startKey)) + 1
  return Math.min(Math.max(n, 1), totalDays)
}

export function endDate(startKey: string, totalDays: number): Date {
  return addDays(fromKey(startKey), totalDays - 1)
}

export function endKey(startKey: string, totalDays: number): string {
  return toKey(endDate(startKey, totalDays))
}

/** Every date key in the challenge, in order. */
export function allDayKeys(startKey: string, totalDays: number): string[] {
  const start = fromKey(startKey)
  return Array.from({ length: totalDays }, (_, i) => toKey(addDays(start, i)))
}

/** 0-based challenge week containing a given 1-based day number. */
export function weekOfDay(dayNo: number): number {
  return Math.floor((dayNo - 1) / 7)
}

export function totalWeeks(totalDays: number): number {
  return Math.ceil(totalDays / 7)
}

/** Date keys belonging to a 0-based challenge week (last week may be short). */
export function weekDayKeys(startKey: string, totalDays: number, week: number): string[] {
  const first = week * 7
  const len = Math.max(0, Math.min(7, totalDays - first))
  const start = fromKey(startKey)
  return Array.from({ length: len }, (_, i) => toKey(addDays(start, first + i)))
}

export function prettyRange(startKey: string, totalDays: number): string {
  const s = fromKey(startKey)
  const e = endDate(startKey, totalDays)
  const sameYear = s.getFullYear() === e.getFullYear()
  const left = format(s, 'dd MMM').toUpperCase()
  const right = format(e, sameYear ? 'dd MMM yyyy' : 'dd MMM yyyy').toUpperCase()
  return `${left} — ${right}`
}

export function prettyDate(d: Date): string {
  return format(d, 'EEEE, d MMMM')
}

export function greetingFor(d: Date): string {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Rest well'
}

export { addDays, differenceInCalendarDays, format }
