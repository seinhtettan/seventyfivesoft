import { Check, Minus, Plus } from 'lucide-react'
import type { Habit } from '@/lib/types'
import { cn } from '@/lib/utils'
import { HabitIcon } from './habit-icons'

interface Props {
  habit: Habit
  done: boolean
  metricValue?: number
  onToggle: () => void
  /** Receives a signed delta in metric units; the store applies it to the stored value. */
  onAdjustMetric?: (delta: number) => void
  disabled?: boolean
  index?: number
}

export function HabitCheck({
  habit,
  done,
  metricValue,
  onToggle,
  onAdjustMetric,
  disabled,
  index = 0,
}: Props) {
  const m = habit.metric
  const value = metricValue ?? 0

  // Deliberately delta-based: deriving the next value from `value` here would
  // drop increments when the buttons are tapped faster than React re-renders.
  const step = (direction: number) => {
    if (!m || !onAdjustMetric) return
    onAdjustMetric(direction * m.step)
  }

  return (
    <div
      className={cn(
        'group animate-fade-up rounded-2xl border transition-all duration-300',
        done
          ? 'border-sage/50 bg-sage-soft/55 shadow-[0_10px_26px_-20px_rgba(127,151,121,0.9)]'
          : 'border-line bg-shell/70 hover:border-blush/60 hover:bg-blush-soft/25',
        disabled && 'opacity-60',
      )}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={done}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-sage/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream rounded-2xl disabled:cursor-not-allowed"
      >
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full border transition-all duration-300',
            done
              ? 'border-sage-deep bg-sage-deep text-white'
              : 'border-taupe bg-cream/70 text-brown-faint group-hover:border-blush-deep/60 group-hover:text-blush-deep',
          )}
        >
          {done ? (
            <Check className="size-4 animate-bloom" strokeWidth={2.5} />
          ) : (
            <HabitIcon name={habit.icon} className="size-4" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[0.95rem] leading-snug transition-colors',
              done ? 'text-sage-deep' : 'text-brown',
            )}
          >
            {habit.name}
          </span>
          {habit.hint && (
            <span className="mt-0.5 block truncate font-hand text-[0.95rem] leading-tight text-brown-faint">
              {habit.hint}
            </span>
          )}
        </span>

        {m && (
          <span
            className={cn(
              'hidden shrink-0 rounded-full px-2.5 py-1 text-xs tabular-nums sm:block',
              value > 0 ? 'bg-cream-deep/80 text-brown-soft' : 'text-brown-faint',
            )}
          >
            {value > 0 ? `${value} ${m.unit}` : m.label}
          </span>
        )}
      </button>

      {m && onAdjustMetric && (
        <div className="flex items-center gap-3 border-t border-line/70 px-4 py-2">
          <span className="eyebrow flex-1 truncate">{m.label}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={disabled}
              aria-label={`Decrease ${m.label}`}
              className="grid size-7 place-items-center rounded-full border border-line text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-16 text-center text-sm tabular-nums text-brown">
              {value}
              <span className="ml-0.5 text-xs text-brown-faint">{m.unit}</span>
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={disabled}
              aria-label={`Increase ${m.label}`}
              className="grid size-7 place-items-center rounded-full border border-line text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-40"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          {m.target != null && (
            <span className="hidden w-14 text-right text-xs text-brown-faint sm:block">
              of {m.target}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
