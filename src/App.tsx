import { useMemo } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { knownExerciseNames } from './domain/meso'
import { DataScreen } from './screens/DataScreen'
import { DayEditScreen } from './screens/DayEditScreen'
import { DayScreen } from './screens/DayScreen'
import { ExerciseScreen } from './screens/ExerciseScreen'
import { HomeScreen } from './screens/HomeScreen'
import { MesoScreen } from './screens/MesoScreen'
import { NewMesoScreen } from './screens/NewMesoScreen'
import type { MesoRepository } from './storage/repository'
import { MesoStoreProvider } from './state/MesoStore'
import { useMesoStore } from './state/storeContext'
import { ExerciseNameSuggestions } from './ui/DayPlanEditor'

// HashRouter keeps the page address after a "#" (…/index.html#/m/abc). Any
// static host can serve that — no server rules needed — and it's what you want
// when the app is later wrapped as a native iPhone app.
export function App({ repository }: { repository: MesoRepository }) {
  return (
    <MesoStoreProvider repository={repository}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </MesoStoreProvider>
  )
}

function Shell() {
  const { status, mesos } = useMesoStore()
  const names = useMemo(() => knownExerciseNames(mesos), [mesos])

  if (status === 'loading') return <div className="splash" aria-busy="true" />
  if (status === 'error') {
    return (
      <div className="splash">
        <p>
          Couldn't open storage on this device. If you're in a private browsing tab, open the app in a normal tab — private tabs can't keep data.
        </p>
      </div>
    )
  }

  return (
    <>
      <ExerciseNameSuggestions names={names} />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/new" element={<NewMesoScreen />} />
        <Route path="/data" element={<DataScreen />} />
        <Route path="/m/:mesoId" element={<MesoScreen />} />
        <Route path="/m/:mesoId/w/:weekId/new-day" element={<DayEditScreen mode="new" />} />
        <Route path="/m/:mesoId/w/:weekId/d/:dayId" element={<DayScreen />} />
        <Route path="/m/:mesoId/w/:weekId/d/:dayId/edit" element={<DayEditScreen mode="edit" />} />
        <Route path="/m/:mesoId/w/:weekId/d/:dayId/x/:exerciseId" element={<ExerciseScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
