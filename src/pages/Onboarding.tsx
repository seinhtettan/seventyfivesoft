import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import type { Habit, Profile, WeightUnit } from '@/lib/types'
import { CHALLENGE_LENGTH, defaultHabits } from '@/lib/defaults'
import { addDays, endDate, format, fromKey, toKey, today } from '@/lib/date'
import { useApp } from '@/store/useApp'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HabitEditor } from '@/components/HabitEditor'
import { HabitIcon } from '@/components/habit-icons'

const steps = ['Your dates', 'Your profile', 'Your habits', 'Lock it in'] as const

export function Onboarding() {
  const finishOnboarding = useApp((s) => s.finishOnboarding)

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [startKey, setStartKey] = useState(() => toKey(today()))
  const [totalDays, setTotalDays] = useState(CHALLENGE_LENGTH)
  const [month, setMonth] = useState(() => today())
  const [unit, setUnit] = useState<WeightUnit>('lb')
  const [profile, setProfile] = useState<Profile>({
    name: '',
    age: undefined,
    heightFeet: undefined,
    heightInches: undefined,
    startWeight: undefined,
    goalWeight: undefined,
  })
  const [habits, setHabits] = useState<Habit[]>(defaultHabits)

  const finish = fromKey(startKey)
  const last = endDate(startKey, totalDays)

  const go = (next: number) => {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  const canContinue =
    step === 0 ? totalDays >= 1 : step === 1 ? profile.name.trim().length > 0 : true

  const submit = () => {
    finishOnboarding({
      profile: { ...profile, name: profile.name.trim() || 'friend' },
      challenge: { startDate: startKey, totalDays },
      habits,
      unit,
    })
  }

  return (
    <div className="min-h-dvh px-5 py-10 md:py-16">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <header className="mb-9 text-center">
          <p className="font-hand text-2xl text-blush-deep">welcome ♡</p>
          <h1 className="mt-1 font-serif text-5xl leading-none tracking-[0.14em] text-brown md:text-6xl">
            75 SOFT
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm font-light leading-relaxed text-brown-soft">
            A gentle, bounded challenge. You choose the days, you choose the habits — then you
            simply keep showing up.
          </p>
        </header>

        {/* Step rail */}
        <ol className="mb-7 flex items-center justify-center gap-2">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i < step && go(i)}
                disabled={i > step}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.16em] transition-all',
                  i === step
                    ? 'bg-brown text-cream'
                    : i < step
                      ? 'text-sage-deep hover:bg-sage-soft/60'
                      : 'text-brown-faint/60',
                )}
              >
                {i < step ? <Check className="size-3" /> : null}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < steps.length - 1 && <span className="h-px w-3 bg-line sm:w-5" />}
            </li>
          ))}
        </ol>

        <div className="overflow-hidden rounded-2xl border border-line bg-shell/80 p-6 shadow-lift backdrop-blur-sm md:p-8">
          {/* Keyed on `step` so each panel remounts and plays its entrance.
              Deliberately no exit animation: an interrupted exit can strand a
              stale panel on screen while the footer moves on. */}
          <motion.div
            key={step}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
              {/* ── Step 1 · dates ── */}
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-serif text-3xl text-brown">When do we begin?</h2>
                    <p className="mt-1.5 text-sm font-light text-brown-soft">
                      Pick your first day. The last day fills in for you — nudge the length if you
                      want a different window.
                    </p>
                  </div>

                  <div className="flex justify-center rounded-2xl border border-line bg-cream/50 p-3">
                    <Calendar
                      mode="range"
                      month={month}
                      onMonthChange={setMonth}
                      selected={{ from: finish, to: last }}
                      onSelect={() => undefined}
                      onDayClick={(d) => setStartKey(toKey(d))}
                      numberOfMonths={1}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="rounded-2xl border border-line bg-cream/50 px-5 py-4">
                      <p className="eyebrow">Your window</p>
                      <p className="mt-1.5 font-serif text-xl text-brown">
                        {format(finish, 'd MMMM yyyy')}
                        <span className="mx-2 text-brown-faint">—</span>
                        {format(last, 'd MMMM yyyy')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-line bg-cream/50 px-5 py-4">
                      <Label htmlFor="length">Length</Label>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <Input
                          id="length"
                          type="number"
                          min={7}
                          max={365}
                          value={totalDays}
                          onChange={(e) =>
                            setTotalDays(Math.min(365, Math.max(7, Number(e.target.value) || 1)))
                          }
                          className="h-9 w-20 text-center"
                        />
                        <span className="text-sm text-brown-soft">days</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStartKey(toKey(today()))
                        setMonth(today())
                      }}
                    >
                      Start today
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const d = addDays(today(), 1)
                        setStartKey(toKey(d))
                        setMonth(d)
                      }}
                    >
                      Start tomorrow
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setTotalDays(CHALLENGE_LENGTH)}>
                      Reset to 75 days
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 2 · profile ── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-serif text-3xl text-brown">A little about you</h2>
                    <p className="mt-1.5 text-sm font-light text-brown-soft">
                      Only your name is needed. Everything else is optional — and stays on this
                      device.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        placeholder="What should I call you?"
                        autoFocus
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="age">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          value={profile.age ?? ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              age: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          placeholder="26"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ft">Height — feet</Label>
                        <Input
                          id="ft"
                          type="number"
                          value={profile.heightFeet ?? ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              heightFeet: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          placeholder="5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="in">Height — inches</Label>
                        <Input
                          id="in"
                          type="number"
                          value={profile.heightInches ?? ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              heightInches: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          placeholder="5"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="unit">Units</Label>
                        <Select value={unit} onValueChange={(v) => setUnit(v as WeightUnit)}>
                          <SelectTrigger id="unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lb">Pounds (lb)</SelectItem>
                            <SelectItem value="kg">Kilograms (kg)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sw">Starting weight</Label>
                        <Input
                          id="sw"
                          type="number"
                          step="0.1"
                          value={profile.startWeight ?? ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              startWeight: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          placeholder={unit === 'lb' ? '150' : '68'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gw">Goal weight</Label>
                        <Input
                          id="gw"
                          type="number"
                          step="0.1"
                          value={profile.goalWeight ?? ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              goalWeight: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          placeholder={unit === 'lb' ? '140' : '63'}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="rounded-xl border border-blush/40 bg-blush-soft/40 px-4 py-3 text-sm font-light leading-relaxed text-brown-soft">
                    Weight is optional and tucked away in its own quiet corner. This challenge is
                    about consistency first.
                  </p>
                </div>
              )}

              {/* ── Step 3 · habits ── */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-serif text-3xl text-brown">Your habits</h2>
                    <p className="mt-1.5 text-sm font-light text-brown-soft">
                      Start from the suggestions, or make them entirely yours. Weekly habits are
                      counted per week — never as a daily miss.
                    </p>
                  </div>
                  <HabitEditor habits={habits} onChange={setHabits} />
                </div>
              )}

              {/* ── Step 4 · review ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-serif text-3xl text-brown">Ready, {profile.name || 'friend'}?</h2>
                    <p className="mt-1.5 text-sm font-light text-brown-soft">
                      Here's what you're committing to. You can always adjust this later in
                      Settings.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-cream/50 px-5 py-4">
                      <p className="eyebrow">Window</p>
                      <p className="mt-1 font-serif text-xl text-brown">{totalDays} days</p>
                      <p className="mt-0.5 text-xs text-brown-soft">
                        {format(finish, 'd MMM yyyy')} — {format(last, 'd MMM yyyy')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-line bg-cream/50 px-5 py-4">
                      <p className="eyebrow">Habits</p>
                      <p className="mt-1 font-serif text-xl text-brown">
                        {habits.filter((h) => h.cadence === 'daily').length} daily
                      </p>
                      <p className="mt-0.5 text-xs text-brown-soft">
                        + {habits.filter((h) => h.cadence === 'weekly').length} weekly
                      </p>
                    </div>
                  </div>

                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {habits.map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center gap-3 rounded-xl border border-line/70 bg-shell/60 px-3.5 py-2.5"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream-deep text-brown-soft">
                          <HabitIcon name={h.icon} className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-brown">{h.name}</span>
                        {h.cadence === 'weekly' && (
                          <span className="shrink-0 rounded-full bg-blush-soft px-2 py-0.5 text-[0.625rem] uppercase tracking-widest text-blush-deep">
                            {h.weeklyTarget}×/wk
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <p className="text-center font-hand text-2xl text-blush-deep">
                    consistency over perfection ♡
                  </p>
                </div>
              )}
          </motion.div>

          {/* Footer nav */}
          <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
            <Button
              variant="ghost"
              onClick={() => go(step - 1)}
              className={cn(step === 0 && 'invisible')}
            >
              <ArrowLeft /> Back
            </Button>

            {step < steps.length - 1 ? (
              <Button variant="default" onClick={() => go(step + 1)} disabled={!canContinue}>
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button variant="sage" size="lg" onClick={submit}>
                <Sparkles /> Begin
              </Button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-light text-brown-faint">
          Everything is stored locally in this browser. No account, no cloud.
        </p>
      </div>
    </div>
  )
}
