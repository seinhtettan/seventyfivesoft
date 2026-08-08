import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Feather, Flame, Quote } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { encouragements } from '@/lib/defaults'
import {
  addDays,
  clampedDayNumber,
  dayNumber,
  endKey,
  format,
  fromKey,
  greetingFor,
  prettyDate,
  toKey,
  today,
  todayKey,
  weekDayKeys,
  weekOfDay,
} from '@/lib/date'
import {
  currentStreak,
  dailyHabits,
  getDay,
  weeklyHabits,
  weeklySessions,
} from '@/lib/stats'
import { cn, pickFrom } from '@/lib/utils'
import { ProgressBar, ProgressRing } from '@/components/ProgressRing'
import { HabitCheck } from '@/components/HabitCheck'
import { WeeklyHabitCard } from '@/components/WeeklyHabitCard'
import { Button } from '@/components/ui/button'

export function Dashboard() {
  const state = useApp()
  const { challenge, habits, profile, days } = state
  const [activeKey, setActiveKey] = useState(() => {
    const t = todayKey()
    const first = challenge.startDate
    const last = endKey(challenge.startDate, challenge.totalDays)
    if (t < first) return first
    if (t > last) return last
    return t
  })

  const t = todayKey()
  const activeDate = fromKey(activeKey)
  const isToday = activeKey === t
  const record = getDay(days, activeKey)
  const daily = dailyHabits(habits)
  const weekly = weeklyHabits(habits)

  const doneCount = daily.filter((h) => record.habits[h.id]).length
  const completion = daily.length ? doneCount / daily.length : 0

  const activeDayNo = dayNumber(challenge.startDate, challenge.totalDays, activeDate)
  const todayDayNo = dayNumber(challenge.startDate, challenge.totalDays, today())
  const shownDayNo = activeDayNo ?? clampedDayNumber(challenge.startDate, challenge.totalDays, activeDate)
  const challengeProgress =
    Math.max(0, Math.min(challenge.totalDays, (todayDayNo ?? (t < challenge.startDate ? 0 : challenge.totalDays)))) /
    challenge.totalDays

  const week = weekOfDay(shownDayNo)
  const weekKeys = weekDayKeys(challenge.startDate, challenge.totalDays, week)

  const streak = useMemo(() => currentStreak(state), [state])
  const quote = useMemo(
    () => pickFrom(encouragements, Number(t.replaceAll('-', ''))),
    [t],
  )

  const notStarted = t < challenge.startDate
  const finished = t > endKey(challenge.startDate, challenge.totalDays)

  const canGoBack = activeKey > challenge.startDate
  const canGoForward = activeKey < t && activeKey < endKey(challenge.startDate, challenge.totalDays)

  const shift = (delta: number) => setActiveKey(toKey(addDays(activeDate, delta)))

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="animate-fade-up overflow-hidden rounded-2xl border border-line bg-shell/75 shadow-soft backdrop-blur-sm">
        <div className="flex flex-col items-center gap-7 px-6 py-8 sm:flex-row sm:items-center sm:gap-9 sm:px-9">
          <ProgressRing
            value={completion}
            size={164}
            stroke={11}
            id="today"
            className="shrink-0"
          >
            <div className="text-center">
              <p className="eyebrow !tracking-[0.2em]">Day</p>
              <p className="font-serif text-4xl leading-none text-brown">
                {String(shownDayNo).padStart(2, '0')}
              </p>
              <p className="mt-0.5 text-xs tracking-[0.18em] text-brown-faint">
                / {challenge.totalDays}
              </p>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-balance font-serif text-[1.75rem] leading-tight text-brown sm:text-4xl">
              {greetingFor(new Date())},{' '}
              {/* nbsp keeps the heart from orphaning onto its own line */}
              <span className="whitespace-nowrap">
                {profile.name || 'friend'}
                {' '}
                <span className="text-blush-deep">♡</span>
              </span>
            </p>
            <p className="mt-1.5 text-sm font-light tracking-wide text-brown-soft">
              {prettyDate(activeDate)}
              {!isToday && (
                <span className="ml-2 rounded-full bg-blush-soft px-2 py-0.5 text-[0.625rem] uppercase tracking-widest text-blush-deep">
                  catching up
                </span>
              )}
            </p>

            <div className="mt-5 space-y-2">
              <div className="flex items-baseline justify-between text-xs">
                <span className="eyebrow">
                  {notStarted
                    ? 'Not started yet'
                    : finished
                      ? 'Challenge complete'
                      : 'Challenge progress'}
                </span>
                <span className="tabular-nums text-brown-soft">
                  {Math.round(challengeProgress * 100)}%
                </span>
              </div>
              <ProgressBar value={challengeProgress} />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-full border border-line bg-cream/70 px-3.5 py-1.5 text-xs text-brown-soft">
                <span className="font-medium text-brown">{doneCount}</span> of {daily.length} today
              </span>
              {streak > 0 && (
                <span className="flex items-center gap-1.5 rounded-full border border-blush/50 bg-blush-soft/60 px-3.5 py-1.5 text-xs text-blush-deep">
                  <Flame className="size-3.5" />
                  {streak} full {streak === 1 ? 'day' : 'days'} in a row
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line/70 bg-cream/40 px-6 py-3.5 sm:px-9">
          <Quote className="size-3.5 shrink-0 text-blush" />
          <p className="font-hand text-xl leading-none text-brown-soft">{quote}</p>
        </div>
      </section>

      {notStarted && (
        <div className="rounded-2xl border border-blush/40 bg-blush-soft/40 px-5 py-4 text-sm font-light text-brown-soft">
          Your challenge begins {format(fromKey(challenge.startDate), 'EEEE, d MMMM')}. Until then,
          rest — you can still set things up in Settings.
        </div>
      )}

      {/* ── Today's habits ── */}
      <section className="space-y-3">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl text-brown">
              {isToday ? 'Today' : format(activeDate, 'EEEE d MMM')}
            </h2>
            <p className="text-xs font-light tracking-wide text-brown-faint">
              Tap anything you've done — nothing is ever locked.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Previous day"
              disabled={!canGoBack}
              onClick={() => shift(-1)}
              className="grid size-9 place-items-center rounded-full border border-line bg-shell/70 text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next day"
              disabled={!canGoForward}
              onClick={() => shift(1)}
              className="grid size-9 place-items-center rounded-full border border-line bg-shell/70 text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </header>

        <div className="space-y-2">
          {daily.map((habit, i) => (
            <HabitCheck
              key={habit.id}
              habit={habit}
              index={i}
              done={!!record.habits[habit.id]}
              metricValue={record.metrics[habit.id]}
              onToggle={() => state.toggleHabit(activeKey, habit.id)}
              onAdjustMetric={
                habit.metric
                  ? (delta) =>
                      state.adjustMetric(
                        activeKey,
                        habit.id,
                        delta,
                        habit.metric!.min,
                        habit.metric!.max,
                      )
                  : undefined
              }
            />
          ))}
          {daily.length === 0 && (
            <p className="rounded-2xl border border-dashed border-taupe bg-cream/50 px-5 py-8 text-center text-sm font-light text-brown-faint">
              No daily habits yet — add a few in Settings.
            </p>
          )}
        </div>

        {completion >= 1 && daily.length > 0 && (
          <p className="animate-fade-up rounded-2xl border border-sage/50 bg-sage-soft/50 px-5 py-4 text-center font-hand text-2xl text-sage-deep">
            every single one — what a lovely day ♡
          </p>
        )}
      </section>

      {/* ── Weekly habits ── */}
      {weekly.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl text-brown">This week</h2>
          {weekly.map((habit) => (
            <WeeklyHabitCard
              key={habit.id}
              habit={habit}
              weekKeys={weekKeys}
              activeKey={activeKey}
              sessionKeys={weekKeys.filter((k) => getDay(days, k).habits[habit.id])}
              onToggleDay={(key) => state.toggleHabit(key, habit.id)}
            />
          ))}
          <p className="px-1 text-xs font-light text-brown-faint">
            Weekly habits are counted across week {week + 1} of {Math.ceil(challenge.totalDays / 7)} —
            they never count against a daily total.{' '}
            {weekly.map((h) => weeklySessions(state, h.id, week)).reduce((a, b) => a + b, 0) === 0
              ? 'A session logged any day this week counts.'
              : ''}
          </p>
        </section>
      )}

      {/* ── Journal nudge ── */}
      <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-gradient-to-br from-blush-soft/50 to-sage-soft/40 px-6 py-5 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="eyebrow">Daily journal</p>
          <p className="mt-1 font-serif text-xl text-brown">
            {record.journal?.win ? 'Today’s win is written down ♡' : 'What went well today?'}
          </p>
          {record.journal?.win && (
            <p className="mt-1 truncate font-hand text-lg text-brown-soft">{record.journal.win}</p>
          )}
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/journal">
            <Feather /> {record.journal?.win ? 'Open journal' : 'Write a line'}
          </Link>
        </Button>
      </section>

      <p
        className={cn(
          'pb-2 text-center text-xs font-light text-brown-faint',
          finished && 'text-sage-deep',
        )}
      >
        {finished
          ? 'You reached the end of your window. However it went — you showed up. ♡'
          : 'One day doesn’t define the challenge.'}
      </p>
    </div>
  )
}
