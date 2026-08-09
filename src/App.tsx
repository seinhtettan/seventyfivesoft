import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from '@/store/useApp'
import { Layout } from '@/components/Layout'
import { Onboarding } from '@/pages/Onboarding'
import { Dashboard } from '@/pages/Dashboard'
import { WeeklyView } from '@/pages/WeeklyView'
import { CalendarView } from '@/pages/CalendarView'
import { JournalView } from '@/pages/JournalView'
import { SettingsView } from '@/pages/SettingsView'

// Split out on its own: the charting library it pulls in is by far the
// heaviest dependency, and most visits never open this page.
const ProgressView = lazy(() =>
  import('@/pages/ProgressView').then((m) => ({ default: m.ProgressView })),
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
  if (!onboarded) return <Onboarding />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="week" element={<WeeklyView />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route
            path="progress"
            element={
              <Suspense fallback={<PageFallback />}>
                <ProgressView />
              </Suspense>
            }
          />
          <Route path="journal" element={<JournalView />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
