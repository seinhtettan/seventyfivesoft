import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from '@/store/useApp'
import { Layout } from '@/components/Layout'

const Onboarding = lazy(() =>
  import('@/pages/Onboarding').then((module) => ({ default: module.Onboarding })),
)
const Dashboard = lazy(() =>
  import('@/pages/Dashboard').then((module) => ({ default: module.Dashboard })),
)
const WeeklyView = lazy(() =>
  import('@/pages/WeeklyView').then((module) => ({ default: module.WeeklyView })),
)
const CalendarView = lazy(() =>
  import('@/pages/CalendarView').then((module) => ({ default: module.CalendarView })),
)
const ProgressView = lazy(() =>
  import('@/pages/ProgressView').then((module) => ({ default: module.ProgressView })),
)
const JournalView = lazy(() =>
  import('@/pages/JournalView').then((module) => ({ default: module.JournalView })),
)
const SettingsView = lazy(() =>
  import('@/pages/SettingsView').then((module) => ({ default: module.SettingsView })),
)

function PageFallback() {
  return (
    <p className="py-20 text-center font-hand text-xl text-brown-faint">one moment ♡</p>
  )
}

export default function App() {
  const hydrated = useApp((s) => s.hydrated)
  const onboarded = useApp((s) => s.onboarded)

  if (!hydrated) return <PageFallback />
  if (!onboarded) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Onboarding />
      </Suspense>
    )
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="week" element={<WeeklyView />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="progress" element={<ProgressView />} />
            <Route path="journal" element={<JournalView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
