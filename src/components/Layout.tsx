import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  NotebookPen,
  Settings as SettingsIcon,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { clampedDayNumber, fromKey, prettyRange, today } from '@/lib/date'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  short: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { to: '/', label: 'Today', short: 'Today', icon: LayoutDashboard },
  { to: '/week', label: 'This week', short: 'Week', icon: CalendarRange },
  { to: '/calendar', label: '75 days', short: '75 days', icon: CalendarDays },
  { to: '/progress', label: 'Progress', short: 'Progress', icon: TrendingUp },
  { to: '/journal', label: 'Journal', short: 'Journal', icon: NotebookPen },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: SettingsIcon },
]

function Wordmark({ compact = false }: { compact?: boolean }) {
  const challenge = useApp((s) => s.challenge)
  return (
    <div className={cn('select-none', compact ? 'text-center' : '')}>
      <h1
        className={cn(
          'font-serif leading-none tracking-[0.16em] text-brown',
          compact ? 'text-xl' : 'text-3xl',
        )}
      >
        75 SOFT
      </h1>
      <p className="eyebrow mt-1.5 !tracking-[0.2em]">
        {prettyRange(challenge.startDate, challenge.totalDays)}
      </p>
    </div>
  )
}

export function Layout() {
  const challenge = useApp((s) => s.challenge)
  const day = clampedDayNumber(challenge.startDate, challenge.totalDays, today())
  const notStarted = today() < fromKey(challenge.startDate)

  return (
    <div className="min-h-dvh md:flex">
      {/* ── Desktop rail ── */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line/80 bg-shell/45 px-7 py-9 backdrop-blur-sm md:flex">
        <Wordmark />

        <div className="mt-8 rounded-2xl border border-line bg-cream/70 px-4 py-3.5">
          <p className="eyebrow">{notStarted ? 'Begins' : 'Day'}</p>
          <p className="mt-1 font-serif text-2xl leading-none text-brown">
            {notStarted ? 'Soon' : String(day).padStart(2, '0')}
            {!notStarted && (
              <span className="text-base text-brown-faint"> / {challenge.totalDays}</span>
            )}
          </p>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-all duration-200',
                  isActive
                    ? 'bg-blush-soft/70 text-brown shadow-[0_8px_20px_-16px_rgba(207,157,148,1)]'
                    : 'text-brown-soft hover:bg-cream-deep/60 hover:text-brown',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'size-4 transition-colors',
                      isActive ? 'text-blush-deep' : 'text-brown-faint',
                    )}
                  />
                  <span className="tracking-wide">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <p className="mt-auto pt-8 font-hand text-lg leading-snug text-brown-faint">
          Consistency over
          <br />
          perfection ♡
        </p>
      </aside>

      {/* ── Content ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pad-safe-top sticky top-0 z-30 border-b border-line/70 bg-cream/80 px-5 pb-3.5 backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-xl leading-none tracking-[0.16em] text-brown">
                75 SOFT
              </h1>
              <p className="eyebrow mt-1">
                {prettyRange(challenge.startDate, challenge.totalDays)}
              </p>
            </div>
            <div className="rounded-full border border-line bg-shell/80 px-3 py-1.5 text-center">
              <span className="font-serif text-lg leading-none text-brown">
                {notStarted ? '—' : String(day).padStart(2, '0')}
              </span>
              <span className="text-xs text-brown-faint"> / {challenge.totalDays}</span>
            </div>
          </div>
        </header>

        <main className="pad-safe-bottom mx-auto w-full max-w-3xl flex-1 px-5 pt-6 md:px-10 md:pt-10 lg:max-w-4xl">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile tab bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-cream/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className="flex items-stretch justify-around">
          {navItems.map(({ to, short, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition-colors',
                  isActive ? 'text-blush-deep' : 'text-brown-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid size-8 place-items-center rounded-full transition-all duration-200',
                      isActive ? 'bg-blush-soft' : 'bg-transparent',
                    )}
                  >
                    <Icon className="size-[1.05rem]" />
                  </span>
                  <span className="text-[0.625rem] tracking-wide">{short}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
