import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Feather } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { addDays, allDayKeys, endKey, format, fromKey, toKey, todayKey } from '@/lib/date'
import { getDay } from '@/lib/stats'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const fields = [
  {
    key: 'win' as const,
    label: 'Today’s win',
    placeholder: 'Even a small one counts…',
  },
  {
    key: 'gratitude' as const,
    label: 'What I’m grateful for',
    placeholder: 'Something ordinary and lovely…',
  },
  {
    key: 'feeling' as const,
    label: 'How I felt',
    placeholder: 'No editing, just honestly…',
  },
  {
    key: 'notes' as const,
    label: 'Notes',
    placeholder: 'Anything else you want to keep.',
  },
]

export function JournalView() {
  const state = useApp()
  const { challenge, days } = state
  const t = todayKey()
  const last = endKey(challenge.startDate, challenge.totalDays)

  const [activeKey, setActiveKey] = useState(() =>
    t < challenge.startDate ? challenge.startDate : t > last ? last : t,
  )

  const record = getDay(days, activeKey)
  const journal = record.journal ?? { win: '', gratitude: '', feeling: '', notes: '' }

  const written = useMemo(
    () =>
      allDayKeys(challenge.startDate, challenge.totalDays)
        .filter((key) => {
          const j = getDay(days, key).journal
          return j && (j.win || j.gratitude || j.feeling || j.notes)
        })
        .reverse(),
    [challenge.startDate, challenge.totalDays, days],
  )

  const canBack = activeKey > challenge.startDate
  const canForward = activeKey < last
  const shift = (d: number) => setActiveKey(toKey(addDays(fromKey(activeKey), d)))

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Daily journal</p>
          <h2 className="mt-1 truncate font-serif text-3xl leading-none text-brown">
            {activeKey === t ? 'Today' : format(fromKey(activeKey), 'd MMMM')}
          </h2>
          <p className="mt-1.5 text-xs font-light tracking-wide text-brown-soft">
            {format(fromKey(activeKey), 'EEEE, d MMMM yyyy')} · saved as you type
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Previous day"
            disabled={!canBack}
            onClick={() => shift(-1)}
            className="grid size-9 place-items-center rounded-full border border-line bg-shell/70 text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next day"
            disabled={!canForward}
            onClick={() => shift(1)}
            className="grid size-9 place-items-center rounded-full border border-line bg-shell/70 text-brown-soft transition-colors hover:bg-cream-deep disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      <section className="animate-fade-up space-y-5 rounded-2xl border border-line bg-gradient-to-br from-shell/85 to-blush-soft/25 p-6 shadow-soft">
        {fields.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Textarea
              id={f.key}
              value={journal[f.key]}
              onChange={(e) => state.setJournal(activeKey, { [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className={cn(
                'bg-shell/70 font-hand text-lg leading-relaxed placeholder:font-sans placeholder:text-sm',
                f.key === 'notes' ? 'min-h-28' : 'min-h-20',
              )}
            />
          </div>
        ))}
      </section>

      {/* past entries */}
      <section className="animate-fade-up space-y-2.5">
        <h3 className="px-1 font-serif text-xl text-brown">Earlier pages</h3>
        {written.length === 0 && (
          <p className="rounded-2xl border border-dashed border-taupe bg-cream/50 px-5 py-8 text-center text-sm font-light text-brown-faint">
            Your written days will collect here.
          </p>
        )}
        {written.map((key) => {
          const j = getDay(days, key).journal!
          const preview = j.win || j.gratitude || j.feeling || j.notes
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveKey(key)}
              className={cn(
                'flex w-full items-start gap-4 rounded-2xl border px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft',
                key === activeKey
                  ? 'border-blush/50 bg-blush-soft/40'
                  : 'border-line bg-shell/70 hover:border-taupe',
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream-deep/80 text-brown-soft">
                <Feather className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs uppercase tracking-[0.16em] text-brown-faint">
                  {format(fromKey(key), 'EEE d MMM')}
                </span>
                <span className="mt-1 block truncate font-hand text-lg text-brown-soft">
                  {preview}
                </span>
              </span>
            </button>
          )
        })}
      </section>

      <p className="pb-2 text-center font-hand text-xl text-brown-faint">
        a few honest lines is enough ♡
      </p>
    </div>
  )
}
