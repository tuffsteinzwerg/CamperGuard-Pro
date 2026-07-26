import { openAppDatabase } from './appDatabase';
import { createUuid } from './uuid';

export interface SnapshotRecord {
  id: string;
  createdAt: string;
  kind: 'daily' | 'weekly';
  size: number;
  json: string;
}

const MAX_DAILY = 7;
const MAX_WEEKLY = 4;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * MIN_INTERVAL_MS;

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist();
    }
  } catch { /* ignorieren */ }
  return false;
}

export async function listSnapshots(): Promise<SnapshotRecord[]> {
  try {
    const db = await openAppDatabase();
    const all: SnapshotRecord[] = await db.getAll('snapshots');
    db.close();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function pruneSnapshots(): Promise<void> {
  try {
    const db = await openAppDatabase();
    const all: SnapshotRecord[] = await db.getAll('snapshots');
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const keep = new Set<string>();
    let daily = 0;
    let weekly = 0;
    for (const s of all) {
      if (s.kind === 'weekly' && weekly < MAX_WEEKLY) { keep.add(s.id); weekly++; }
      else if (s.kind === 'daily' && daily < MAX_DAILY) { keep.add(s.id); daily++; }
    }
    for (const s of all) {
      if (!keep.has(s.id)) await db.delete('snapshots', s.id);
    }

    let kept = all.filter(s => keep.has(s.id));
    let total = kept.reduce((sum, s) => sum + (s.size || 0), 0);
    while (total > MAX_TOTAL_BYTES && kept.length > 1) {
      const oldest = kept[kept.length - 1];
      await db.delete('snapshots', oldest.id);
      total -= oldest.size || 0;
      kept = kept.slice(0, -1);
    }
    db.close();
  } catch { /* ignorieren */ }
}

export async function createSnapshotIfDue(): Promise<SnapshotRecord | null> {
  try {
    const db = await openAppDatabase();
    const appState = await db.get('store', 'state');
    if (!appState) { db.close(); return null; }

    const all: SnapshotRecord[] = await db.getAll('snapshots');
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const newest = all[0];
    const nowMs = Date.now();

    if (newest && nowMs - new Date(newest.createdAt).getTime() < MIN_INTERVAL_MS) {
      db.close();
      return null;
    }

    const json = JSON.stringify(appState);
    if (newest && newest.json === json) { db.close(); return null; }

    const newestWeekly = all.find(s => s.kind === 'weekly');
    const needWeekly = !newestWeekly ||
      (nowMs - new Date(newestWeekly.createdAt).getTime() >= WEEK_MS);

    const record: SnapshotRecord = {
      id: createUuid(),
      createdAt: new Date().toISOString(),
      kind: needWeekly ? 'weekly' : 'daily',
      size: json.length,
      json
    };
    await db.put('snapshots', record);
    db.close();
    await pruneSnapshots();
    return record;
  } catch {
    return null;
  }
}
