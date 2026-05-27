// Guard4Campers — Google Drive Service
// Liest und schreibt Sync-Daten auf Google Drive
// Verwendet drive.file Scope (nur eigene Dateien der App)

import { getValidToken } from './googleAuth';

const FOLDER_NAME = 'Guard4Campers';
const FILE_NAME = 'guard4campers-sync.json';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ─── Ordner finden oder erstellen ───

async function findFolder(token: string): Promise<string | null> {
  const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive API Fehler: ${res.status}`);
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

async function createFolder(token: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  if (!res.ok) throw new Error(`Ordner erstellen fehlgeschlagen: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function getOrCreateFolder(token: string): Promise<string> {
  const existing = await findFolder(token);
  if (existing) return existing;
  return createFolder(token);
}

// ─── Sync-Datei finden ───

async function findSyncFile(token: string, folderId: string): Promise<string | null> {
  const query = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive API Fehler: ${res.status}`);
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

// ─── Datei auf Drive schreiben ───

export async function writeSyncFile(appState: any): Promise<void> {
  const token = getValidToken();
  if (!token) throw new Error('Nicht eingeloggt');

  const folderId = await getOrCreateFolder(token);
  const fileId = await findSyncFile(token, folderId);

  const payload = {
    _meta: {
      app: 'Guard4Campers',
      version: '0.2.1-dev',
      syncDate: new Date().toISOString(),
      format: 1
    },
    data: appState
  };

  const content = JSON.stringify(payload, null, 2);

  if (fileId) {
    // Bestehende Datei aktualisieren
    const res = await fetch(
      `${UPLOAD_API}/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: content
      }
    );
    if (!res.ok) throw new Error(`Datei aktualisieren fehlgeschlagen: ${res.status}`);
  } else {
    // Neue Datei erstellen (multipart upload)
    const metadata = {
      name: FILE_NAME,
      parents: [folderId],
      mimeType: 'application/json'
    };

    const boundary = '---g4c_boundary_' + Date.now();
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const res = await fetch(
      `${UPLOAD_API}/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      }
    );
    if (!res.ok) throw new Error(`Datei erstellen fehlgeschlagen: ${res.status}`);
  }
}

// ─── Datei von Drive lesen ───

export interface SyncFileData {
  _meta: {
    app: string;
    version: string;
    syncDate: string;
    format: number;
  };
  data: any;
}

export async function readSyncFile(): Promise<SyncFileData | null> {
  const token = getValidToken();
  if (!token) throw new Error('Nicht eingeloggt');

  const folderId = await findFolder(token);
  if (!folderId) return null;

  const fileId = await findSyncFile(token, folderId);
  if (!fileId) return null;

  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Datei lesen fehlgeschlagen: ${res.status}`);

  const data = await res.json();

  // Validierung
  if (!data._meta || !data.data) return null;
  if (data._meta.app !== 'Guard4Campers' && data._meta.app !== 'CamperGuard Pro') return null;

  return data as SyncFileData;
}

// ─── Zeitstempel der letzten Änderung auf Drive holen ───

export async function getRemoteModifiedTime(): Promise<string | null> {
  const token = getValidToken();
  if (!token) return null;

  const folderId = await findFolder(token);
  if (!folderId) return null;

  const query = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,modifiedTime)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].modifiedTime : null;
}
