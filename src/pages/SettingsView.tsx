import { useEffect, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, Download, RotateCcw, Upload } from 'lucide-react'
import { useApp } from '@/store/useApp'
import type { WeightUnit } from '@/lib/types'
import type { SyncConflict } from '@/lib/sync'
import {
  getSyncStatus,
  listSyncConflicts,
  resolveSyncConflict,
  subscribeSyncStatus,
} from '@/data/runtime'
import { endDate, format, fromKey, toKey } from '@/lib/date'
import { fromDisplayWeight, toDisplayWeight } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HabitEditor } from '@/components/HabitEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="animate-fade-up rounded-2xl border border-line bg-shell/75 p-6 shadow-soft">
      <h3 className="font-serif text-2xl text-brown">{title}</h3>
      {description && <p className="mt-1 text-sm font-light text-brown-soft">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function SettingsView() {
  const state = useApp()
  const { profile, challenge, habits, settings } = state
  const unit = settings.unit

  const [startW, setStartW] = useState('')
  const [goalW, setGoalW] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [month, setMonth] = useState(() => fromKey(challenge.startDate))
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const syncStatus = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus)

  useEffect(() => {
    let active = true
    if (syncStatus !== 'conflict') {
      setConflicts([])
      return () => {
        active = false
      }
    }
    void listSyncConflicts().then((next) => {
      if (active) setConflicts(next)
    })
    return () => {
      active = false
    }
  }, [syncStatus])

  // Keep the weight fields in sync with the chosen unit.
  useEffect(() => {
    const s = toDisplayWeight(profile.startWeight, unit)
    const g = toDisplayWeight(profile.goalWeight, unit)
    setStartW(s == null ? '' : String(Number(s.toFixed(1))))
    setGoalW(g == null ? '' : String(Number(g.toFixed(1))))
  }, [unit, profile.startWeight, profile.goalWeight])

  const commitWeight = (raw: string, field: 'startWeight' | 'goalWeight') => {
    if (!raw.trim()) {
      state.updateProfile({ [field]: undefined })
      return
    }
    const n = Number(raw)
    if (Number.isFinite(n)) state.updateProfile({ [field]: fromDisplayWeight(n, unit) })
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(useApp.getState(), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `75-soft-${toKey(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const { profile: p, challenge: c, habits: h, settings: st, days, reflections, progress } =
          parsed
        state.importState({
          ...(p ? { profile: p } : {}),
          ...(c ? { challenge: c } : {}),
          ...(h ? { habits: h } : {}),
          ...(st ? { settings: st } : {}),
          ...(days ? { days } : {}),
          ...(reflections ? { reflections } : {}),
          ...(progress ? { progress } : {}),
          onboarded: true,
        })
      } catch {
        alert('That file could not be read as 75 Soft data.')
      }
    }
    reader.readAsText(file)
  }

  const resolveConflict = async (mutationId: string, resolution: 'local' | 'server') => {
    await resolveSyncConflict(mutationId, resolution)
    setConflicts(await listSyncConflicts())
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="eyebrow">Make it yours</p>
        <h2 className="mt-1 font-serif text-3xl leading-none text-brown">Settings</h2>
        <p className="mt-1.5 text-sm font-light text-brown-soft">
          Change anything, any time. Your history stays exactly where it is.
        </p>
      </header>

      {/* ── Profile ── */}
      <Section title="Profile">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-name">Name</Label>
            <Input
              id="s-name"
              value={profile.name}
              onChange={(e) => state.updateProfile({ name: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="s-age">Age</Label>
              <Input
                id="s-age"
                type="number"
                value={profile.age ?? ''}
                onChange={(e) =>
                  state.updateProfile({
                    age: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-ft">Height — feet</Label>
              <Input
                id="s-ft"
                type="number"
                value={profile.heightFeet ?? ''}
                onChange={(e) =>
                  state.updateProfile({
                    heightFeet: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-in">Height — inches</Label>
              <Input
                id="s-in"
                type="number"
                value={profile.heightInches ?? ''}
                onChange={(e) =>
                  state.updateProfile({
                    heightInches: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Dates ── */}
      <Section
        title="Challenge dates"
        description="Move the start or change the length — nothing you've already logged is lost."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>First day</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 w-full justify-start rounded-xl">
                  {format(fromKey(challenge.startDate), 'd MMMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-3">
                <Calendar
                  mode="single"
                  month={month}
                  onMonthChange={setMonth}
                  selected={fromKey(challenge.startDate)}
                  onSelect={(d) => d && state.updateChallenge({ startDate: toKey(d) })}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-len">Length (days)</Label>
            <Input
              id="s-len"
              type="number"
              min={7}
              max={365}
              value={challenge.totalDays}
              onChange={(e) =>
                state.updateChallenge({
                  totalDays: Math.min(365, Math.max(7, Number(e.target.value) || 7)),
                })
              }
            />
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-line bg-cream/60 px-4 py-3 text-sm font-light text-brown-soft">
          Your window runs{' '}
          <span className="text-brown">
            {format(fromKey(challenge.startDate), 'd MMM yyyy')} —{' '}
            {format(endDate(challenge.startDate, challenge.totalDays), 'd MMM yyyy')}
          </span>
          .
        </p>
      </Section>

      {/* ── Weight ── */}
      <Section
        title="Weight & units"
        description="Entirely optional. Leave these blank if you'd rather not track numbers."
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-line bg-cream/60 px-4 py-3">
            <div>
              <p className="text-sm text-brown">Show weight in kilograms</p>
              <p className="text-xs font-light text-brown-faint">
                Currently {unit === 'lb' ? 'pounds (lb)' : 'kilograms (kg)'}
              </p>
            </div>
            <Switch
              checked={unit === 'kg'}
              onCheckedChange={(on) =>
                state.updateSettings({ unit: (on ? 'kg' : 'lb') as WeightUnit })
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-sw">Starting weight ({unit})</Label>
              <Input
                id="s-sw"
                type="number"
                step="0.1"
                value={startW}
                onChange={(e) => {
                  setStartW(e.target.value)
                  commitWeight(e.target.value, 'startWeight')
                }}
                placeholder="optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-gw">Goal weight ({unit})</Label>
              <Input
                id="s-gw"
                type="number"
                step="0.1"
                value={goalW}
                onChange={(e) => {
                  setGoalW(e.target.value)
                  commitWeight(e.target.value, 'goalWeight')
                }}
                placeholder="optional"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Habits ── */}
      <Section
        title="Habits"
        description="Rename, reorder, add or retire. Past days keep whatever you already ticked."
      >
        <HabitEditor habits={habits} onChange={state.setHabits} />
      </Section>

      {conflicts.length > 0 && (
        <Section
          title="Sync conflicts"
          description="The same item changed on two devices while one was offline. Choose which copy to keep."
        >
          <div className="space-y-3">
            {conflicts.map((conflict) => (
              <div
                key={conflict.mutationId}
                className="rounded-xl border border-blush-deep/40 bg-blush-soft/35 p-4"
              >
                <p className="text-sm text-brown">
                  {conflict.entityType} · {conflict.entityId}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void resolveConflict(conflict.mutationId, 'local')}
                  >
                    Keep this device
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void resolveConflict(conflict.mutationId, 'server')}
                  >
                    Use synced version
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Data ── */}
      <Section
        title="Your data"
        description="Available offline on this device and synchronized through your private home server."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download /> Export a backup
          </Button>

          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload /> Restore from file
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) importData(file)
                  e.target.value = ''
                }}
              />
            </label>
          </Button>
        </div>

        <Separator className="my-6" />

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogTrigger asChild>
            <Button variant="danger">
              <RotateCcw /> Reset everything
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-blush-deep" /> Start over?
              </DialogTitle>
              <DialogDescription>
                This clears your habits, ticked days, journal entries, reflections and check-ins
                everywhere after the next sync. It can't be undone — consider exporting a backup first.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setResetOpen(false)}>
                Keep my data
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  state.resetAll()
                  setResetOpen(false)
                }}
              >
                Yes, reset everything
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <p className="pb-2 text-center font-hand text-xl text-brown-faint">
        adjust as often as you need ♡
      </p>
    </div>
  )
}
