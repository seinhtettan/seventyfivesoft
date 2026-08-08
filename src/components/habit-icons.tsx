import {
  Activity,
  Apple,
  BookOpen,
  Coffee,
  Droplet,
  Feather,
  Flower2,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Salad,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Wind,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const habitIcons: Record<string, LucideIcon> = {
  sunrise: Sunrise,
  phone: Smartphone,
  tea: Coffee,
  book: BookOpen,
  walk: Footprints,
  salad: Salad,
  apple: Apple,
  droplet: Droplet,
  moon: Moon,
  sparkles: Sparkles,
  flower: Flower2,
  heart: Heart,
  leaf: Leaf,
  wind: Wind,
  sun: Sun,
  star: Star,
  feather: Feather,
  activity: Activity,
}

export const iconKeys = Object.keys(habitIcons)

export function HabitIcon({ name, className }: { name: string; className?: string }) {
  const Icon = habitIcons[name] ?? Sparkles
  return <Icon className={className} />
}
