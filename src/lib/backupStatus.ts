import { openAppDatabase } from './appDatabase';

const KEY = 'lastBackupAt';

export async function getLastBackupAt(): Promise<string | null> {
  try {
    const db = await openAppDatabase();
    const value = await db.get('appMeta', KEY);
    db.close();
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

export async function markBackupDone(): Promise<void> {
  try {
    const db = await openAppDatabase();
    await db.put('appMeta', new Date().toISOString(), KEY);
    db.close();
  } catch { /* ignorieren */ }
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return null;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
