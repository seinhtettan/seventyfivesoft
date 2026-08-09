import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { format, fromKey, todayKey } from '@/lib/date'
import { cn, formatWeight, fromDisplayWeight, toDisplayWeight } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RatingScale } from '@/components/RatingScale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function ProgressView() {
  const state = useApp()
  const { profile, progress, settings } = state
  const unit = settings.unit

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayKey)
  const [weight, setWeight] = useState('')
  const [mood, setMood] = useState<number | undefined>()
  const [energy, setEnergy] = useState<number | undefined>()
  const [notes, setNotes] = useState('')

  const weighed = useMemo(
    () => progress.filter((p) => typeof p.weight === 'number'),
    [progress],
  )
  const latest = weighed.length ? weighed[weighed.length - 1] : undefined
  const start = profile.startWeight
  const goal = profile.goalWeight
  const change =
    latest?.weight != null && start != null ? latest.weight - start : undefined

  const chartData = useMemo(
    () =>
      weighed.map((p) => ({
        date: p.date,
        label: format(fromKey(p.date), 'd MMM'),
        weight: Number((toDisplayWeight(p.weight, unit) ?? 0).toFixed(1)),
      })),
    [weighed, unit],
  )

  const domain = useMemo(() => {
    const values = [
      ...chartData.map((d) => d.weight),
      toDisplayWeight(start, unit),
      toDisplayWeight(goal, unit),
    ].filter((v): v is number => typeof v === 'number')
    if (!values.length) return [0, 1] as [number, number]
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max(2, (max - min) * 0.35)
    return [Math.floor(min - pad), Math.ceil(max + pad)] as [number, number]
  }, [chartData, start, goal, unit])

  const reset = () => {
    setDate(todayKey())
    setWeight('')
    setMood(undefined)
    setEnergy(undefined)
    setNotes('')
  }

  const save = () => {
    const w = weight.trim() ? fromDisplayWeight(Number(weight), unit) : undefined
    state.addProgress({
      date,
      weight: Number.isFinite(w) ? w : undefined,
      mood,
      energy,
      notes: notes.trim() || undefined,
    })
    reset()
    setOpen(false)
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Optional & unhurried</p>
          <h2 className="mt-1 font-serif text-3xl leading-none text-brown">Progress</h2>
          <p className="mt-1.5 max-w-md text-sm font-light text-brown-soft">
            A weekly check-in is plenty. Numbers are just one small part of how this is going.
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (o) setDate(todayKey())
          }}
        >
          <DialogTrigger asChild>
            <Button variant="sage">
              <Plus /> Add check-in
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Weekly check-in</DialogTitle>
              <DialogDescription>
                Every field is optional — log only what feels useful.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-date">Date</Label>
                  <Input
                    id="p-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-weight">Weight ({unit})</Label>
                  <Input
                    id="p-weight"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="optional"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-cream/50 px-4 py-3">
                  <RatingScale label="Mood" value={mood} onChange={setMood} />
                </div>
                <div className="rounded-xl border border-line bg-cream/50 px-4 py-3">
                  <RatingScale label="Energy" value={energy} onChange={setEnergy} tone="sage" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-notes">Notes</Label>
                <Textarea
                  id="p-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How has your body felt this week?"
                  className="font-hand text-lg placeholder:font-sans placeholder:text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="sage" onClick={save}>
                Save check-in
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {/* numbers */}
      <section className="animate-fade-up grid gap-3 sm:grid-cols-3">
        <NumberTile label="Starting" value={formatWeight(start, unit)} />
        <NumberTile label="Current" value={formatWeight(latest?.weight, unit)} tone="blush" />
        <NumberTile label="Goal" value={formatWeight(goal, unit)} tone="sage" />
      </section>

      {change != null && (
        <p className="px-1 text-sm font-light text-brown-soft">
          {Math.abs(change) < 0.05 ? (
            <>Holding steady since day one — steady is a result too.</>
          ) : (
            <>
              <span className="font-medium text-brown">
                {formatWeight(Math.abs(change), unit)}
              </span>{' '}
              {change < 0 ? 'lighter' : 'heavier'} than your starting number. Bodies move in waves —
              keep going ♡
            </>
          )}
        </p>
      )}

      {/* chart */}
      <section className="animate-fade-up rounded-2xl border border-line bg-shell/75 p-5 shadow-soft sm:p-6">
        <h3 className="font-serif text-xl text-brown">Weight trend</h3>
        {chartData.length < 2 ? (
          <p className="mt-6 rounded-xl border border-dashed border-taupe bg-cream/50 px-5 py-10 text-center text-sm font-light text-brown-faint">
            {chartData.length === 0
              ? 'No entries yet. Add a check-in whenever you like.'
              : 'One more check-in and a line will appear here.'}
          </p>
        ) : (
          <WeightTrendChart
            data={chartData}
            domain={domain}
            goal={toDisplayWeight(goal, unit)}
            unit={unit}
          />
        )}
      </section>

      {/* entries */}
      <section className="animate-fade-up space-y-2.5">
        <h3 className="px-1 font-serif text-xl text-brown">Check-ins</h3>
        {progress.length === 0 && (
          <p className="rounded-2xl border border-dashed border-taupe bg-cream/50 px-5 py-8 text-center text-sm font-light text-brown-faint">
            Nothing logged yet.
          </p>
        )}
        {[...progress].reverse().map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-4 rounded-2xl border border-line bg-shell/70 px-5 py-4"
          >
            <div className="w-16 shrink-0">
              <p className="font-serif text-lg leading-none text-brown">
                {format(fromKey(entry.date), 'd MMM')}
              </p>
              <p className="mt-1 text-[0.625rem] uppercase tracking-widest text-brown-faint">
                {format(fromKey(entry.date), 'yyyy')}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {entry.weight != null && (
                  <span className="rounded-full bg-blush-soft/70 px-3 py-1 text-xs text-blush-deep">
                    {formatWeight(entry.weight, unit)}
                  </span>
                )}
                {entry.mood != null && entry.mood > 0 && (
                  <span className="rounded-full bg-cream-deep px-3 py-1 text-xs text-brown-soft">
                    mood {entry.mood}/5
                  </span>
                )}
                {entry.energy != null && entry.energy > 0 && (
                  <span className="rounded-full bg-sage-soft/70 px-3 py-1 text-xs text-sage-deep">
                    energy {entry.energy}/5
                  </span>
                )}
              </div>
              {entry.notes && (
                <p className="mt-2 font-hand text-lg leading-snug text-brown-soft">{entry.notes}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Delete check-in"
              onClick={() => state.removeProgress(entry.id)}
              className="grid size-8 shrink-0 place-items-center rounded-full text-taupe transition-colors hover:bg-blush-soft hover:text-blush-deep"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </section>

      <p className="pb-2 text-center font-hand text-xl text-brown-faint">
        the scale is not the story ♡
      </p>
    </div>
  )
}

interface WeightChartPoint {
  date: string
  label: string
  weight: number
}

function WeightTrendChart({
  data,
  domain,
  goal,
  unit,
}: {
  data: WeightChartPoint[]
  domain: [number, number]
  goal: number | undefined
  unit: 'lb' | 'kg'
}) {
  const container = useRef<HTMLDivElement>(null)
  const descriptionId = useId()
  const [width, setWidth] = useState(640)
  const height = 240
  const margin = { top: 14, right: 16, bottom: 30, left: 48 }
  const plotWidth = Math.max(1, width - margin.left - margin.right)
  const plotHeight = height - margin.top - margin.bottom
  const range = Math.max(1, domain[1] - domain[0])
  const x = (index: number) => margin.left + (index / Math.max(1, data.length - 1)) * plotWidth
  const y = (weight: number) => margin.top + ((domain[1] - weight) / range) * plotHeight
  const points = data.map((point, index) => ({ ...point, x: x(index), y: y(point.weight) }))
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const area = `${line} L ${points.at(-1)!.x} ${margin.top + plotHeight} L ${points[0]!.x} ${margin.top + plotHeight} Z`
  const ticks = Array.from({ length: 4 }, (_, index) => domain[0] + (index / 3) * range)
  const labelIndexes = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])

  useEffect(() => {
    const element = container.current
    if (element === null) return
    const updateWidth = (nextWidth: number) => {
      if (nextWidth > 0) setWidth(nextWidth)
    }
    updateWidth(element.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry !== undefined) updateWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={container} className="mt-4 h-60 w-full">
      <svg
        width={width}
        height={height}
        className="block h-60 w-full overflow-visible"
        role="img"
        aria-label={`Weight trend in ${unit}`}
        aria-describedby={descriptionId}
      >
        <defs>
          <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cf9d94" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#cf9d94" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={margin.left + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#ebe0d3"
              strokeDasharray="4 6"
            />
            <text x={margin.left - 8} y={y(tick) + 4} textAnchor="end" fill="#a6968a" fontSize="11">
              {Number(tick.toFixed(1))}
            </text>
          </g>
        ))}
        {goal !== undefined && goal >= domain[0] && goal <= domain[1] && (
          <g>
            <line
              x1={margin.left}
              x2={margin.left + plotWidth}
              y1={y(goal)}
              y2={y(goal)}
              stroke="#7f9779"
              strokeDasharray="5 5"
            />
            <text
              x={margin.left + plotWidth - 4}
              y={y(goal) - 6}
              textAnchor="end"
              fill="#7f9779"
              fontSize="11"
            >
              goal
            </text>
          </g>
        )}
        <path d={area} fill="url(#weightFill)" />
        <path d={line} fill="none" stroke="#cf9d94" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#fffdfa" stroke="#cf9d94" strokeWidth="2">
              <title>{`${point.label}: ${point.weight} ${unit}`}</title>
            </circle>
            {labelIndexes.has(index) && (
              <text x={point.x} y={height - 8} textAnchor="middle" fill="#a6968a" fontSize="11">
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div id={descriptionId} className="sr-only">
        <p>
          {goal === undefined
            ? 'No goal weight is set.'
            : `Goal weight: ${Number(goal.toFixed(1))} ${unit}.`}
        </p>
        <table>
          <caption>Weight trend data</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Weight</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point, index) => (
              <tr key={`${point.date}-${index}`}>
                <td>{point.label}</td>
                <td>{`${point.weight} ${unit}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NumberTile({
  label,
  value,
  tone = 'plain',
}: {
  label: string
  value: string
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
    </div>
  )
}
