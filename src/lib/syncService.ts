// Guard4Campers — Sync Service
// Koordiniert den Datenabgleich zwischen lokalem State und Google Drive
// Strategie: "Letzter Schreiber gewinnt" (Timestamp-basiert)

import { getValidToken } from './googleAuth';
import { writeSyncFile, readSyncFile } from './googleDrive';

// Zeitstempel der letzten lokalen Änderung
let lastLocalChange: number = 0;

// Zeitstempel des letzten erfolgreichen Uploads
let lastUploadTime: number = 0;

// Verhindert parallele Sync-Vorgänge
let isSyncing: boolean = false;

// Minimum Abstand zwischen Uploads (Sekunden)
const UPLOAD_DEBOUNCE_MS = 5000;

// ─── Lokale Änderung registrieren ───

export function markLocalChange(): void {
  lastLocalChange = Date.now();
}

// ─── State auf Drive hochladen (mit Debounce) ───

export async function uploadState(appState: any): Promise<{ success: boolean; error?: string }> {
  // Nicht eingeloggt → still ignorieren
  const token = getValidToken();
  if (!token) return { success: false, error: 'not_signed_in' };

  // Bereits am syncen → überspringen
  if (isSyncing) return { success: false, error: 'sync_in_progress' };

  // Debounce: nicht zu oft hochladen
  if (Date.now() - lastUploadTime < UPLOAD_DEBOUNCE_MS) {
    return { success: false, error: 'debounce' };
  }

  isSyncing = true;
  try {
    await writeSyncFile(appState);
    lastUploadTime = Date.now();
    return { success: true };
  } catch (err) {
    console.error('Drive Upload fehlgeschlagen:', err);
    return { success: false, error: String(err) };
  } finally {
    isSyncing = false;
  }
}

// ─── Beim App-Start: prüfen ob Drive einen neueren Stand hat ───

export interface SyncCheckResult {
  hasRemoteData: boolean;
  remoteIsNewer: boolean;
  remoteData: any | null;
  remoteSyncDate: string | null;
}

export async function checkForRemoteUpdate(localLastSaved: string | null): Promise<SyncCheckResult> {
  const token = getValidToken();
  if (!token) {
    return { hasRemoteData: false, remoteIsNewer: false, remoteData: null, remoteSyncDate: null };
  }

  try {
    const remoteFile = await readSyncFile();
    if (!remoteFile) {
      return { hasRemoteData: false, remoteIsNewer: false, remoteData: null, remoteSyncDate: null };
    }

    const remoteSyncDate = remoteFile._meta.syncDate;
    let remoteIsNewer = false;

    if (localLastSaved) {
      const localTime = new Date(localLastSaved).getTime();
      const remoteTime = new Date(remoteSyncDate).getTime();
      remoteIsNewer = remoteTime > localTime;
    } else {
      // Kein lokaler Zeitstempel → Remote ist "neuer"
      remoteIsNewer = true;
    }

    return {
      hasRemoteData: true,
      remoteIsNewer,
      remoteData: remoteFile.data,
      remoteSyncDate
    };
  } catch (err) {
    console.error('Remote-Check fehlgeschlagen:', err);
    return { hasRemoteData: false, remoteIsNewer: false, remoteData: null, remoteSyncDate: null };
  }
}
