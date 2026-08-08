import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { Habit } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HabitIcon, iconKeys } from './habit-icons'

interface Props {
  habits: Habit[]
  onChange: (habits: Habit[]) => void
}

const newId = () =>
  `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function HabitEditor({ habits, onChange }: Props) {
  const update = (id: string, patch: Partial<Habit>) =>
    onChange(habits.map((h) => (h.id === id ? { ...h, ...patch } : h)))

  const remove = (id: string) => onChange(habits.filter((h) => h.id !== id))

  const move = (index: number, dir: -1 | 1) => {
    const next = [...habits]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  const add = (cadence: 'daily' | 'weekly') =>
    onChange([
      ...habits,
      {
        id: newId(),
        name: cadence === 'daily' ? 'New daily habit' : 'New weekly habit',
        icon: 'heart',
        cadence,
        ...(cadence === 'weekly' ? { weeklyTarget: 2, weeklyBonus: 3 } : {}),
      },
    ])

  const daily = habits.filter((h) => h.cadence === 'daily')
  const weekly = habits.filter((h) => h.cadence === 'weekly')

  const row = (habit: Habit) => {
    const index = habits.indexOf(habit)
    return (
      <div
        key={habit.id}
        className="rounded-2xl border border-line bg-shell/70 p-3 transition-colors hover:border-taupe"
      >
        <div className="flex items-start gap-2.5">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Choose icon"
                className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border border-line bg-cream/70 text-brown-soft transition-colors hover:border-blush hover:text-blush-deep"
              >
                <HabitIcon name={habit.icon} className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <p className="eyebrow mb-3">Icon</p>
              <div className="grid grid-cols-6 gap-1.5">
                {iconKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update(habit.id, { icon: key })}
                    className={cn(
                      'grid size-9 place-items-center rounded-full border transition-colors',
                      habit.icon === key
                        ? 'border-sage-deep bg-sage-soft text-sage-deep'
                        : 'border-transparent text-brown-soft hover:bg-cream-deep',
                    )}
                  >
                    <HabitIcon name={key} className="size-4" />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="min-w-0 flex-1 space-y-2">
            <Input
              value={habit.name}
              onChange={(e) => update(habit.id, { name: e.target.value })}
              placeholder="Habit name"
              className="h-10"
            />
            <Input
              value={habit.hint ?? ''}
              onChange={(e) => update(habit.id, { hint: e.target.value })}
              placeholder="A gentle note to yourself (optional)"
              className="h-9 border-dashed font-hand text-base placeholder:font-sans placeholder:text-xs"
            />

            {habit.cadence === 'weekly' && (
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-brown-soft">
                  <span className="eyebrow">Target / week</span>
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    value={habit.weeklyTarget ?? 2}
                    onChange={(e) =>
                      update(habit.id, { weeklyTarget: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="h-8 w-16 px-2 text-center"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-brown-soft">
                  <span className="eyebrow">Bonus at</span>
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    value={habit.weeklyBonus ?? 3}
                    onChange={(e) =>
                      update(habit.id, { weeklyBonus: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="h-8 w-16 px-2 text-center"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <button
              type="button"
              aria-label="Move up"
              onClick={() => move(index, -1)}
              className="grid size-6 place-items-center rounded-full text-brown-faint transition-colors hover:bg-cream-deep hover:text-brown"
            >
              <ChevronDown className="size-3.5 rotate-180" />
            </button>
            <button
              type="button"
              aria-label="Move down"
              onClick={() => move(index, 1)}
              className="grid size-6 place-items-center rounded-full text-brown-faint transition-colors hover:bg-cream-deep hover:text-brown"
            >
              <ChevronDown className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Remove ${habit.name}`}
              onClick={() => remove(habit.id)}
              className="mt-1 grid size-6 place-items-center rounded-full text-taupe transition-colors hover:bg-blush-soft hover:text-blush-deep"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <Label>Daily habits</Label>
          <span className="text-xs text-brown-faint">{daily.length} habits</span>
        </div>
        {daily.map(row)}
        <Button variant="outline" size="sm" onClick={() => add('daily')} className="w-full">
          <Plus /> Add a daily habit
        </Button>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <Label>Weekly habits</Label>
          <span className="text-xs text-brown-faint">counted per week, not per day</span>
        </div>
        {weekly.map(row)}
        <Button variant="outline" size="sm" onClick={() => add('weekly')} className="w-full">
          <Plus /> Add a weekly habit
        </Button>
      </section>
    </div>
  )
}
