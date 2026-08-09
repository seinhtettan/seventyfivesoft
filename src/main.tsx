import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootstrapOfflineClient } from './data/bootstrap'
import { materializeState } from './data/materialize-state'
import { startSyncLoop, subscribeSyncedEntities } from './data/runtime'
import { useApp } from './store/useApp'

const root = createRoot(document.getElementById('root')!)

root.render(
  <StrictMode>
    <p className="py-20 text-center font-hand text-xl text-brown-faint">one moment ♡</p>
  </StrictMode>,
)

void bootstrapOfflineClient({
  isHydrated: () => useApp.getState().hydrated,
  subscribeHydration: (listener) =>
    useApp.subscribe((state) => {
      if (state.hydrated) listener()
    }),
  subscribeEntities: () => {
    subscribeSyncedEntities((entities) => {
      if (entities.length === 0) return
      useApp.setState(materializeState(entities, useApp.getState()))
    })
  },
  synchronize: startSyncLoop,
  render: () => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  },
})
