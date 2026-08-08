import { Heart, Plus, Sparkles } from 'lucide-react'
import type { Habit } from '@/lib/types'
import { cn } from '@/lib/utils'
import { format, fromKey, todayKey } from '@/lib/date'
import { HabitIcon } from './habit-icons'

interface Props {
  habit: Habit
  /** date keys of the current challenge week, in order */
  weekKeys: string[]
  /** date keys within the week that have a logged session */
  sessionKeys: string[]
  onToggleDay: (key: string) => void
  activeKey: string
}

export function WeeklyHabitCard({
  habit,
  weekKeys,
  sessionKeys,
  onToggleDay,
  activeKey,
}: Props) {
  const target = habit.weeklyTarget ?? 2
  const bonus = habit.weeklyBonus ?? target + 1
  const count = sessionKeys.length
  const metTarget = count >= target
  const gotBonus = count >= bonus
  const t = todayKey()

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border transition-colors duration-500',
        metTarget ? 'border-sage/50 bg-sage-soft/40' : 'border-line bg-shell/70',
      )}
    >
      <div className="flex items-center gap-4 px-5 pt-5">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full transition-colors',
            metTarget ? 'bg-sage-deep text-white' : 'bg-cream-deep text-brown-soft',
          )}
        >
          <HabitIcon name={habit.icon} className="size-[1.15rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{habit.name} this week</p>
          <p className="mt-1 flex items-baseline gap-1.5 font-serif text-2xl leading-none text-brown">
            {count} <span className="text-brown-faint">/ {target}</span>
            <span className="ml-1 text-sm font-sans font-light tracking-wide text-brown-soft">
              {count === 1 ? 'session' : 'sessions'}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {Array.from({ length: Math.max(target, count) }, (_, i) => (
            <Heart
              key={i}
              className={cn(
                'size-4 transition-colors',
                i < count
                  ? i >= target
                    ? 'fill-gold text-gold'
                    : 'fill-sage-deep text-sage-deep'
                  : 'text-taupe',
              )}
            />
          ))}
        </div>
      </div>

      {/* week strip */}
      <div className="mt-4 flex gap-1.5 px-5">
        {weekKeys.map((key) => {
          const on = sessionKeys.includes(key)
          const isFuture = key > t
          return (
            <button
              key={key}
              type="button"
              disabled={isFuture}
              onClick={() => onToggleDay(key)}
              title={format(fromKey(key), 'EEEE d MMM')}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 text-[0.625rem] uppercase tracking-widest transition-all',
                on
                  ? 'border-sage-deep bg-sage-deep text-white'
                  : 'border-line bg-cream/60 text-brown-faint hover:border-sage/60 hover:bg-sage-soft/50',
                isFuture && 'opacity-40 hover:border-line hover:bg-cream/60',
                key === activeKey && !on && 'ring-1 ring-blush/70',
              )}
            >
              <span>{format(fromKey(key), 'EEEEE')}</span>
              <span className="text-[0.6875rem] font-medium normal-case tracking-normal">
                {format(fromKey(key), 'd')}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/70 bg-cream/40 px-5 py-3">
        <p className="min-w-0 flex-1 truncate font-hand text-lg leading-none text-brown-soft">
          {gotBonus
            ? 'a bonus session ♡'
            : metTarget
              ? `${bonus - count} more is a bonus`
              : `${target - count} to go this week`}
        </p>
        {gotBonus ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[0.625rem] uppercase tracking-[0.16em] text-gold">
            <Sparkles className="size-3" /> Bonus
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onToggleDay(activeKey > t ? t : activeKey)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-shell px-3 py-1.5 text-xs text-brown-soft transition-colors hover:border-sage/60 hover:text-sage-deep"
          >
            <Plus className="size-3" /> Log session
          </button>
        )}
      </div>
    </section>
  )
}
