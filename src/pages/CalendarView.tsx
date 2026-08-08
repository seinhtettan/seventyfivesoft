import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { allDayKeys, format, fromKey, todayKey } from '@/lib/date'
import { dailyHabits, dayCompletion, getDay, overallStats, weeklyHabits } from '@/lib/stats'
import { cn } from '@/lib/utils'
import { HabitIcon } from '@/components/habit-icons'
import { ProgressBar } from '@/components/ProgressRing'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function CalendarView() {
  const state = useApp()
  const { challenge, habits, days } = state
  const keys = useMemo(
    () => allDayKeys(challenge.startDate, challenge.totalDays),
    [challenge.startDate, challenge.totalDays],
  )
  const t = todayKey()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const stats = useMemo(() => overallStats(state), [state])

  const daily = dailyHabits(habits)
  const weekly = weeklyHabits(habits)
  const openRecord = openKey ? getDay(days, openKey) : null
  const openDayNo = openKey ? keys.indexOf(openKey) + 1 : 0

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="eyebrow">The whole window</p>
        <h2 className="mt-1 font-serif text-3xl leading-none text-brown">
          {challenge.totalDays} days
        </h2>
        <p className="mt-1.5 text-sm font-light text-brown-soft">
          Every square is a day you get to fill in. Missed ones simply stay soft — nothing resets.
        </p>
      </header>

      {/* summary */}
      <section className="animate-fade-up grid gap-3 sm:grid-cols-3">
        <Tile label="Days elapsed" value={`${stats.elapsedDays}`} sub={`of ${challenge.totalDays}`} />
        <Tile label="Full days" value={`${stats.completeDays}`} sub="all habits ticked" tone="sage" />
        <Tile
          label="Average day"
          value={`${Math.round(stats.averageCompletion * 100)}%`}
          sub="across elapsed days"
          tone="blush"
        />
      </section>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-brown-faint">
        <Legend className="border-line bg-cream" label="Open" />
        <Legend className="border-blush/50 bg-blush-soft" label="Partly done" />
        <Legend className="border-sage/60 bg-sage-soft" label="Complete" />
        <Legend className="border-brown/40 bg-cream ring-1 ring-brown/25" label="Today" />
      </div>

      {/* grid */}
      <section className="animate-fade-up rounded-2xl border border-line bg-shell/70 p-4 shadow-soft sm:p-6">
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 sm:gap-2">
          {keys.map((key, i) => {
            const pctDone = dayCompletion(days, habits, key)
            const future = key > t
            const isToday = key === t
            return (
              <button
                key={key}
                type="button"
                onClick={() => setOpenKey(key)}
                className={cn(
                  'group relative aspect-square overflow-hidden rounded-xl border p-1.5 text-left transition-all duration-200',
                  'hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/50',
                  future
                    ? 'border-dashed border-taupe/50 bg-cream/40'
                    : pctDone >= 1
                      ? 'border-sage/60 bg-sage-soft'
                      : pctDone > 0
                        ? 'border-blush/50 bg-blush-soft/60'
                        : 'border-line bg-cream/70',
                  isToday && 'ring-1 ring-brown/35 ring-offset-2 ring-offset-cream',
                )}
                title={`Day ${i + 1} · ${format(fromKey(key), 'd MMM')}`}
              >
                {!future && pctDone > 0 && pctDone < 1 && (
                  <span
                    className="absolute inset-x-0 bottom-0 bg-blush/35"
                    style={{ height: `${pctDone * 100}%` }}
                  />
                )}
                <span className="relative flex h-full flex-col justify-between">
                  <span className="text-[0.625rem] font-medium tabular-nums leading-none text-brown-soft">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex items-end justify-between gap-1">
                    <span className="text-[0.5625rem] leading-none text-brown-faint">
                      {format(fromKey(key), 'd MMM')}
                    </span>
                    {!future &&
                      (pctDone >= 1 ? (
                        <Check className="size-3 shrink-0 text-sage-deep" strokeWidth={2.5} />
                      ) : pctDone > 0 ? (
                        <span className="shrink-0 text-[0.5rem] tabular-nums leading-none text-blush-deep">
                          {Math.round(pctDone * 100)}%
                        </span>
                      ) : null)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <p className="pb-2 text-center font-hand text-xl text-brown-faint">
        one day doesn’t define the challenge ♡
      </p>

      {/* day detail */}
      <Dialog open={openKey != null} onOpenChange={(o) => !o && setOpenKey(null)}>
        <DialogContent>
          {openKey && openRecord && (
            <>
              <DialogHeader>
                <p className="eyebrow">Day {String(openDayNo).padStart(2, '0')}</p>
                <DialogTitle>{format(fromKey(openKey), 'EEEE, d MMMM')}</DialogTitle>
                <DialogDescription>
                  {openKey > t
                    ? 'Still to come — you can plan, but there’s nothing to tick yet.'
                    : 'Tap to fill in anything you missed.'}
                </DialogDescription>
              </DialogHeader>

              <div className="mb-4">
                <div className="mb-2 flex items-baseline justify-between text-xs">
                  <span className="eyebrow">Completion</span>
                  <span className="tabular-nums text-brown-soft">
                    {Math.round(dayCompletion(days, habits, openKey) * 100)}%
                  </span>
                </div>
                <ProgressBar value={dayCompletion(days, habits, openKey)} />
              </div>

              <ul className="space-y-1.5">
                {[...daily, ...weekly].map((h) => {
                  const done = !!openRecord.habits[h.id]
                  const value = openRecord.metrics[h.id]
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        disabled={openKey > t}
                        onClick={() => state.toggleHabit(openKey, h.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-50',
                          done
                            ? 'border-sage/50 bg-sage-soft/60'
                            : 'border-line bg-cream/50 hover:border-blush/50 hover:bg-blush-soft/30',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-full border',
                            done
                              ? 'border-sage-deep bg-sage-deep text-white'
                              : 'border-taupe text-brown-faint',
                          )}
                        >
                          {done ? (
                            <Check className="size-3.5" strokeWidth={2.5} />
                          ) : (
                            <HabitIcon name={h.icon} className="size-3.5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-brown">{h.name}</span>
                        {h.cadence === 'weekly' && (
                          <span className="shrink-0 rounded-full bg-blush-soft px-2 py-0.5 text-[0.5625rem] uppercase tracking-widest text-blush-deep">
                            weekly
                          </span>
                        )}
                        {value != null && value > 0 && (
                          <span className="shrink-0 text-xs tabular-nums text-brown-faint">
                            {value} {h.metric?.unit}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              {openRecord.journal?.win && (
                <div className="mt-4 rounded-xl border border-line bg-cream/60 px-4 py-3">
                  <p className="eyebrow">Today’s win</p>
                  <p className="mt-1 font-hand text-lg text-brown-soft">{openRecord.journal.win}</p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Tile({
  label,
  value,
  sub,
  tone = 'plain',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'plain' | 'sage' | 'blush'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-5 py-4',
        tone === 'sage'
          ? 'border-sage/40 bg-sage-soft/40'
          : tone === 'blush'
            ? 'border-blush/40 bg-blush-soft/40'
            : 'border-line bg-shell/70',
      )}
    >
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-serif text-3xl leading-none text-brown">{value}</p>
      {sub && <p className="mt-1 text-xs font-light text-brown-faint">{sub}</p>}
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('size-3.5 rounded-md border', className)} />
      {label}
    </span>
  )
}
