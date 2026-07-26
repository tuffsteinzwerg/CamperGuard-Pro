import { openAppDatabase } from './appDatabase';
import { createUuid } from './uuid';
import { SYNC_BASE_URL } from './cloudflareProvider';

const PENDING_KEY = 'pendingJoinRequestId';

export async function getOrCreateDeviceId(): Promise<string> {
  const db = await openAppDatabase();
  let deviceId = await db.get('appMeta', 'deviceId');
  if (!deviceId) {
    deviceId = createUuid();
    await db.put('appMeta', deviceId, 'deviceId');
  }
  db.close();
  return deviceId as string;
}

export async function getPendingRequestId(): Promise<string | null> {
  try {
    const db = await openAppDatabase();
    const value = await db.get('appMeta', PENDING_KEY);
    db.close();
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

export async function setPendingRequestId(requestId: string | null): Promise<void> {
  try {
    const db = await openAppDatabase();
    if (requestId) {
      await db.put('appMeta', requestId, PENDING_KEY);
    } else {
      await db.delete('appMeta', PENDING_KEY);
    }
    db.close();
  } catch { /* ignorieren */ }
}

async function postJson(path: string, body: any): Promise<any> {
  const res = await fetch(SYNC_BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data: any = {};
  try { data = await res.json(); } catch { /* leer */ }
  if (!res.ok) throw new Error(data && data.error ? data.error : 'Server nicht erreichbar');
  return data;
}

export async function fetchJoinCode(vehicleId: string): Promise<string> {
  const deviceId = await getOrCreateDeviceId();
  const data = await postJson('/group/code', { vehicleId, deviceId });
  return data.joinCode;
}

export async function requestJoin(joinCode: string, deviceLabel?: string): Promise<any> {
  const deviceId = await getOrCreateDeviceId();
  const data = await postJson('/group/join', { joinCode, deviceId, deviceLabel });
  if (data && data.requestId) await setPendingRequestId(data.requestId);
  return data;
}

export async function getJoinStatus(requestId: string): Promise<any> {
  const res = await fetch(SYNC_BASE_URL + '/group/status?requestId=' + encodeURIComponent(requestId));
  let data: any = {};
  try { data = await res.json(); } catch { /* leer */ }
  if (!res.ok) throw new Error(data && data.error ? data.error : 'Server nicht erreichbar');
  return data;
}
