import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const LB_PER_KG = 2.2046226218

export function toDisplayWeight(lb: number | undefined, unit: 'lb' | 'kg'): number | undefined {
  if (lb == null || Number.isNaN(lb)) return undefined
  return unit === 'lb' ? lb : lb / LB_PER_KG
}

export function fromDisplayWeight(value: number, unit: 'lb' | 'kg'): number {
  return unit === 'lb' ? value : value * LB_PER_KG
}

export function formatWeight(lb: number | undefined, unit: 'lb' | 'kg', digits = 1): string {
  const v = toDisplayWeight(lb, unit)
  if (v == null) return '—'
  return `${Number(v.toFixed(digits))} ${unit}`
}

export function pickFrom<T>(list: T[], seed: number): T {
  return list[Math.abs(seed) % list.length]
}
