import { useParams } from 'react-router-dom'
import { useMesoStore } from '../state/storeContext'

/** Looks up the meso, week, day and exercise named in the current URL. Anything missing is undefined. */
export function useRouteData() {
  const { mesoId, weekId, dayId, exerciseId } = useParams()
  const store = useMesoStore()
  const meso = store.get(mesoId)
  const weekIndex = meso?.weeks.findIndex((w) => w.id === weekId) ?? -1
  const week = meso?.weeks[weekIndex]
  const dayIndex = week?.days.findIndex((d) => d.id === dayId) ?? -1
  const day = week?.days[dayIndex]
  const exercise = day?.exercises.find((e) => e.id === exerciseId)
  return { store, meso, week, weekIndex, day, dayIndex, exercise }
}

export const paths = {
  home: () => '/',
  newMeso: () => '/new',
  data: () => '/data',
  meso: (mesoId: string) => `/m/${mesoId}`,
  day: (mesoId: string, weekId: string, dayId: string) => `/m/${mesoId}/w/${weekId}/d/${dayId}`,
  exercise: (mesoId: string, weekId: string, dayId: string, exerciseId: string) => `/m/${mesoId}/w/${weekId}/d/${dayId}/x/${exerciseId}`,
  editDay: (mesoId: string, weekId: string, dayId: string) => `/m/${mesoId}/w/${weekId}/d/${dayId}/edit`,
  newDay: (mesoId: string, weekId: string) => `/m/${mesoId}/w/${weekId}/new-day`,
}
