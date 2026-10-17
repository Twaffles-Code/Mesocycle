// Browsers may clear a website's stored data when the device runs low on
// space — and Safari on iPhone can clear it after 7 days without a visit
// unless the site was added to the Home Screen. Asking for "persistent"
// storage tells the browser this data matters and shouldn't be evicted.
// It's a request, not a guarantee, which is why the app also offers backups.

export type PersistenceState = 'persisted' | 'not-granted' | 'unsupported'

export async function requestPersistentStorage(): Promise<PersistenceState> {
  if (!navigator.storage?.persist) return 'unsupported'
  try {
    if (await navigator.storage.persisted()) return 'persisted'
    return (await navigator.storage.persist()) ? 'persisted' : 'not-granted'
  } catch {
    return 'unsupported'
  }
}

/** True when opened from the Home Screen rather than a browser tab. */
export function isInstalledApp(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

// ── Small per-device preferences ─────────────────────────────────────────
// localStorage can throw (private browsing, blocked storage), so every access
// is wrapped. Losing a preference is harmless; crashing the app is not.

const LAST_MESO_KEY = 'meso:lastMesoId'
const LAST_BACKUP_KEY = 'meso:lastBackupAt'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* preference not saved; nothing else depends on it */
  }
}

export const preferences = {
  lastMesoId: () => read(LAST_MESO_KEY),
  setLastMesoId: (id: string) => write(LAST_MESO_KEY, id),
  lastBackupAt: () => read(LAST_BACKUP_KEY),
  setLastBackupAt: (iso: string) => write(LAST_BACKUP_KEY, iso),
}
