import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '@/store/useApp'
import {
  clampedDayNumber,
  format,
  fromKey,
  today,
  todayKey,
  totalWeeks,
  weekOfDay,
} from '@/lib/date'
import {
  dailyHabits,
  dayCompletion,
  habitStreak,
  weekStats,
  weeklyHabits,
} from '@/lib/stats'
import { cn } from '@/lib/utils'
import { ProgressRing } from '@/components/ProgressRing'
import { RatingScale } from '@/components/RatingScale'
import { HabitIcon } from '@/components/habit-icons'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function WeeklyView() {
  const state = useApp()
  const { challenge, habits, reflections } = state

  const weeks = totalWeeks(challenge.totalDays)
  const currentWeek = weekOfDay(
    clampedDayNumber(challenge.startDate, challenge.totalDays, today()),
  )
  const [week, setWeek] = useState(currentWeek)

  const stats = useMemo(() => weekStats(state, week), [state, week])
  const daily = dailyHabits(habits)
  const weekly = weeklyHabits(habits)
  const reflection = reflections[week] ?? { win: '', intention: '' }
  const t = todayKey()

  const metricHabits = habits.filter((h) => h.metric)

  return (
    <div className="space-y-6">
      {/* ── Week header ── */}
      <header className="animate-fade-up flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Weekly rhythm</p>
          <h2 className="mt-1 font-serif text-3xl leading-none text-brown">
            Week {week + 1}
            <span className="text-brown-faint"> of {weeks}</span>
          </h2>
          <p className="mt-1.5 text-xs font-light tracking-wide text-brown-soft">
            {format(fromKey(stats.keys[0]), 'd MMM')} —{' '}
            {format(fromKey(stats.keys[stats.keys.length - 1]), 'd MMM yyyy')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Previous week"
            disabled={week === 0}
            onClick={() => setWeek((w) => Math.max(0, w - 1))}
            className="grid size-9 place-items-center rounded-full border border-line bg-shell/70 text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next week"
            disabled={week >= weeks - 1}
            onClick={() => setWeek((w) => Math.min(weeks - 1, w + 1))}
            className="grid size-9 place-items-center rounded-full border border-line bg-shell/70 text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      {/* ── Completion + day strip ── */}
      <section className="animate-fade-up rounded-2xl border border-line bg-shell/75 p-6 shadow-soft">
        <div className="flex flex-col items-center gap-7 sm:flex-row sm:gap-9">
          <ProgressRing value={stats.completion} size={140} stroke={10} id="week" from="#a9bda4" to="#cf9d94">
            <div className="text-center">
              <p className="font-serif text-3xl leading-none text-brown">
                {Math.round(stats.completion * 100)}%
              </p>
              <p className="eyebrow mt-1">complete</p>
            </div>
          </ProgressRing>

          <div className="w-full flex-1">
            <div className="flex gap-1.5">
              {stats.keys.map((key) => {
                const pctDone = dayCompletion(state.days, habits, key)
                const future = key > t
                return (
                  <div key={key} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[0.625rem] uppercase tracking-widest text-brown-faint">
                      {format(fromKey(key), 'EEEEE')}
                    </span>
                    <div
                      className={cn(
                        'relative h-16 w-full overflow-hidden rounded-xl border transition-colors',
                        future
                          ? 'border-dashed border-taupe/60 bg-cream/40'
                          : pctDone >= 1
                            ? 'border-sage/60 bg-sage-soft'
                            : pctDone > 0
                              ? 'border-blush/50 bg-blush-soft/50'
                              : 'border-line bg-cream/60',
                        key === t && 'ring-1 ring-brown/30 ring-offset-1 ring-offset-cream',
                      )}
                    >
                      {!future && pctDone > 0 && pctDone < 1 && (
                        <div
                          className="absolute inset-x-0 bottom-0 bg-blush/45"
                          style={{ height: `${pctDone * 100}%` }}
                        />
                      )}
                      <span className="absolute inset-0 grid place-items-center text-xs tabular-nums text-brown-soft">
                        {format(fromKey(key), 'd')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Stat label="Full days" value={`${stats.perfectDays}`} />
              <Stat label="Days elapsed" value={`${stats.elapsedDays} / ${stats.keys.length}`} />
              {weekly.map((h) => (
                <Stat
                  key={h.id}
                  label={h.name}
                  value={`${stats.perHabit[h.id] ?? 0} / ${h.weeklyTarget ?? 2}`}
                  tone={(stats.perHabit[h.id] ?? 0) >= (h.weeklyTarget ?? 2) ? 'sage' : 'plain'}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Averages ── */}
      {metricHabits.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          {metricHabits.map((h) => {
            const avg = stats.perMetricAvg[h.id]
            return (
              <div
                key={h.id}
                className="animate-fade-up rounded-2xl border border-line bg-shell/70 px-5 py-4"
              >
                <p className="eyebrow truncate">Avg {h.metric?.label ?? h.name}</p>
                <p className="mt-1.5 font-serif text-2xl leading-none text-brown">
                  {avg != null ? Number(avg.toFixed(1)) : '—'}
                  <span className="ml-1 text-sm font-sans font-light text-brown-faint">
                    {h.metric?.unit}
                  </span>
                </p>
                {h.metric?.target != null && (
                  <p className="mt-1 text-xs font-light text-brown-faint">
                    aiming for {h.metric.target} {h.metric.unit}
                  </p>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* ── Per-habit tally ── */}
      <section className="animate-fade-up rounded-2xl border border-line bg-shell/70 p-6">
        <h3 className="font-serif text-xl text-brown">Habit by habit</h3>
        <p className="mt-0.5 text-xs font-light text-brown-faint">
          Days completed this week, and your current run.
        </p>
        <ul className="mt-4 space-y-2.5">
          {daily.map((h) => {
            const n = stats.perHabit[h.id] ?? 0
            const streak = habitStreak(state, h.id)
            return (
              <li key={h.id} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cream-deep/70 text-brown-soft">
                  <HabitIcon name={h.icon} className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-brown">{h.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-brown-soft">
                      {n} / {stats.keys.length}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-taupe-soft">
                    <span
                      className="block h-full rounded-full bg-sage transition-[width] duration-700"
                      style={{ width: `${(n / stats.keys.length) * 100}%` }}
                    />
                  </span>
                </span>
                <span
                  className={cn(
                    'w-14 shrink-0 text-right text-[0.625rem] uppercase tracking-widest',
                    streak > 0 ? 'text-sage-deep' : 'text-brown-faint/60',
                  )}
                >
                  {streak > 0 ? `${streak}d run` : '—'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── Reflection ── */}
      <section className="animate-fade-up rounded-2xl border border-line bg-gradient-to-br from-blush-soft/40 to-cream p-6 shadow-soft">
        <h3 className="font-serif text-2xl text-brown">How did I feel this week?</h3>
        <p className="mt-0.5 text-xs font-light text-brown-faint">
          Saved automatically — week {week + 1}.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-shell/70 px-4 py-3">
            <RatingScale
              label="Energy"
              value={reflection.energy}
              onChange={(v) => state.setReflection(week, { energy: v })}
              tone="sage"
            />
          </div>
          <div className="rounded-xl border border-line bg-shell/70 px-4 py-3">
            <RatingScale
              label="Mood"
              value={reflection.mood}
              onChange={(v) => state.setReflection(week, { mood: v })}
            />
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="win">Biggest win</Label>
            <Textarea
              id="win"
              value={reflection.win}
              onChange={(e) => state.setReflection(week, { win: e.target.value })}
              placeholder="Something you're quietly proud of…"
              className="min-h-20 font-hand text-lg placeholder:font-sans placeholder:text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="intention">Next week's intention</Label>
            <Textarea
              id="intention"
              value={reflection.intention}
              onChange={(e) => state.setReflection(week, { intention: e.target.value })}
              placeholder="One soft thing to carry forward…"
              className="min-h-20 font-hand text-lg placeholder:font-sans placeholder:text-sm"
            />
          </div>
        </div>
      </section>

      <p className="pb-2 text-center font-hand text-xl text-brown-faint">
        every week is its own small season ♡
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'plain',
}: {
  label: string
  value: string
  tone?: 'plain' | 'sage'
}) {
  return (
    <span
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs',
        tone === 'sage'
          ? 'border-sage/50 bg-sage-soft/60 text-sage-deep'
          : 'border-line bg-cream/70 text-brown-soft',
      )}
    >
      <span className="text-brown-faint">{label} </span>
      <span className="font-medium tabular-nums">{value}</span>
    </span>
  )
}
