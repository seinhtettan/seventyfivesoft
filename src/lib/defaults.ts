import type { Habit } from './types'

export const CHALLENGE_LENGTH = 75

export const defaultHabits: Habit[] = [
  {
    id: 'wake',
    name: 'Wake before 9:00 AM',
    hint: 'A slow, unhurried start',
    icon: 'sunrise',
    cadence: 'daily',
  },
  {
    id: 'no-social',
    name: 'No social media before 10 AM',
    hint: 'The morning belongs to me',
    icon: 'phone',
    cadence: 'daily',
  },
  {
    id: 'tea-reading',
    name: 'Morning tea + 10–20 min reading',
    hint: 'Something warm, something read',
    icon: 'tea',
    cadence: 'daily',
  },
  {
    id: 'walk',
    name: 'Walk for 60 minutes',
    hint: 'Anywhere, any pace',
    icon: 'walk',
    cadence: 'daily',
    metric: { label: 'Minutes walked', unit: 'min', target: 60, step: 5, min: 0, max: 240 },
  },
  {
    id: 'nourish',
    name: 'Nourishing meals — 80/20',
    hint: 'Mostly whole foods, room for joy',
    icon: 'salad',
    cadence: 'daily',
  },
  {
    id: 'hydrate',
    name: 'Hydrate consistently',
    hint: 'Sip through the day',
    icon: 'droplet',
    cadence: 'daily',
    metric: { label: 'Glasses', unit: 'glasses', target: 8, step: 1, min: 0, max: 16 },
  },
  {
    id: 'sleep',
    name: 'Sleep 7–9 hours',
    hint: 'Rest is part of the work',
    icon: 'moon',
    cadence: 'daily',
    metric: { label: 'Hours slept', unit: 'h', target: 8, step: 0.5, min: 0, max: 14 },
  },
  {
    id: 'self-care',
    name: '10-minute self-care reset',
    hint: 'Stretch, skincare, stillness',
    icon: 'sparkles',
    cadence: 'daily',
  },
  {
    id: 'pilates',
    name: 'Pilates',
    hint: '2 sessions a week — a third is a gift',
    icon: 'flower',
    cadence: 'weekly',
    weeklyTarget: 2,
    weeklyBonus: 3,
  },
]

export const encouragements = [
  'Consistency over perfection.',
  'One day doesn’t define the challenge.',
  'Keep going ♡',
  'Softness is still discipline.',
  'You are allowed to begin again, gently.',
  'Small things, repeated, become everything.',
  'Rest counts as progress too.',
  'Come back to it — that’s the whole practice.',
]

