import { InMemoryLoopbackBackend, LoopbackSyncProvider } from './loopbackProvider';
import { IDBSyncStateRepository } from './syncRepositories';
import { SyncCoordinator } from './syncCoordinator';
import type { SyncStatus } from './syncCoordinator';
import { openAppDatabase } from './appDatabase';

const backend = new InMemoryLoopbackBackend();
const provider = new LoopbackSyncProvider(backend);
const stateRepository = new IDBSyncStateRepository();

export const syncCoordinator = new SyncCoordinator(provider, stateRepository);

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

export async function startSync(): Promise<void> {
  if (started) return;
  started = true;
  try {
    await provider.connect();
    const db = await openAppDatabase();
    const appState = await db.get('store', 'state');
    db.close();
    const vehicleId = appState?.vehicleId;
    if (!vehicleId) { started = false; return; }

    const init = await provider.initializeRemoteStore({ vehicleId });
    await stateRepository.update('loopback', (current) => ({
      providerId: 'loopback',
      remoteCursor: current?.remoteCursor ?? init.initialCursor,
      lastSuccessfulSyncAt: current?.lastSuccessfulSyncAt,
      lastAttemptAt: current?.lastAttemptAt,
      initializationState: 'ready',
    }));

    await syncCoordinator.runSync();
    if (!timer) {
      timer = setInterval(() => { syncCoordinator.runSync().catch(() => {}); }, 8000);
    }
  } catch {
    started = false;
  }
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  return syncCoordinator.subscribe(listener);
}

export async function countPendingOutbox(): Promise<number> {
  try {
    const db = await openAppDatabase();
    const n = await db.count('outbox');
    db.close();
    return n;
  } catch { return 0; }
}
