import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { createIndexedDbRepository } from './storage/indexedDb'
import { requestPersistentStorage } from './storage/persistence'
import './index.css'

// The one place that decides where data is stored. To move to a server or to
// native iPhone storage later, build another MesoRepository and pass it in here.
const repository = createIndexedDbRepository()
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={repository} />
  </StrictMode>,
)
