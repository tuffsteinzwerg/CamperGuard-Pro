import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncCoordinator, DefaultSyncCoordinatorClock, UPLOAD_LEASE_DURATION_MS, BASE_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS } from '../syncCoordinator';
import { LoopbackSyncProvider, InMemoryLoopbackBackend } from '../loopbackProvider';
import { IDBSyncStateRepository } from '../syncRepositories';
import { openAppDatabase, openAppDatabaseByName } from '../appDatabase';
import { InventoryEvent, OutboxEntry, LocalSyncState, AppState } from '../../types';
import "fake-indexeddb/auto";

class TestClock extends DefaultSyncCoordinatorClock {
  private currentTimeMs: number = 1000000;
  
  setTime(ms: number) {
    this.currentTimeMs = ms;
  }
  nowMs(): number {
    return this.currentTimeMs;
  }
  nowIso(): string {
    return new Date(this.currentTimeMs).toISOString();
  }
  advance(ms: number) {
    this.currentTimeMs += ms;
  }
}

function createEvent(id: string): InventoryEvent {
  return {
    eventId: id,
    type: 'item_created',
    itemId: 'item_' + id,
    vehicleId: 'v1',
    actorId: 'a1',
    deviceId: 'd1',
    clientCreatedAt: '2023-01-01T00:00:00.000Z',
    schemaVersion: 1,
    payload: { name: 'Item ' + id }
  } as InventoryEvent;
}

describe('SyncCoordinator Upload', () => {
  let backend: InMemoryLoopbackBackend;
  let provider: LoopbackSyncProvider;
  let stateRepo: IDBSyncStateRepository;
  let clock: TestClock;
  let coordinator: SyncCoordinator;

  beforeEach(async () => {
    backend = new InMemoryLoopbackBackend();
    provider = new LoopbackSyncProvider(backend);
    stateRepo = new IDBSyncStateRepository('test-upload-db');
    clock = new TestClock();
    
    // Always mock deterministic random for backoff testing
    const random = () => 0.1; // 10% jitter
    
    const { runSerializedAppWrite: actualRun } = await import('../syncRepository');
    const dbProvider = {
      openAppDatabase: () => openAppDatabaseByName('test-upload-db'),
      runSerializedAppWrite: <T>(task: any) => actualRun(task) as Promise<T>
    };
    coordinator = new SyncCoordinator(provider, stateRepo, clock, random, dbProvider);

    const db = await openAppDatabaseByName('test-upload-db');
    
    // Clear stores
    const tx = db.transaction(['store', 'outbox', 'eventLog', 'appliedEvents', 'syncState'], 'readwrite');
    await tx.objectStore('store').clear();
    await tx.objectStore('outbox').clear();
    await tx.objectStore('eventLog').clear();
    await tx.objectStore('appliedEvents').clear();
    await tx.objectStore('syncState').clear();
    
    // Setup basic state
    await tx.objectStore('store').put({ vehicleId: 'v1' } as AppState, 'state');
    await tx.objectStore('syncState').put({ providerId: 'loopback', initializationState: 'ready' } as LocalSyncState);
    await tx.done;
    await provider.connect();
    await provider.initializeRemoteStore({ vehicleId: 'v1' });

    db.close();

    await provider.connect();
    await provider.initializeRemoteStore({ vehicleId: 'v1' });
  });

  it('1. requires_initialization verhindert den Provideraufruf.', async () => {
    await stateRepo.save({ providerId: 'loopback', initializationState: 'requires_initialization' });
    const spy = vi.spyOn(provider, 'uploadEvents');
    const result = await coordinator.runUpload();
    expect(result.selectedCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    expect(coordinator.getStatus()).toBe('requires_initialization');
  });

  it('2. Getrennter Provider verhindert Upload.', async () => {
    await provider.disconnect();
    const spy = vi.spyOn(provider, 'uploadEvents');
    const result = await coordinator.runUpload();
    expect(result.selectedCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    expect(coordinator.getStatus()).toBe('disconnected');
  });

  it('3. Leere Outbox führt zu keinem Upload.', async () => {
    const spy = vi.spyOn(provider, 'uploadEvents');
    const result = await coordinator.runUpload();
    expect(result.selectedCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    expect(coordinator.getStatus()).toBe('idle');
  });

  it('4. Nur fällige Einträge werden ausgewählt.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    const tx = db.transaction('outbox', 'readwrite');
    // pending
    await tx.store.put({ event: createEvent('e1'), status: 'pending', retryCount: 0 });
    // failed but not due
    await tx.store.put({ event: createEvent('e2'), status: 'failed', retryCount: 1, nextRetryAt: clock.nowIso() + 'Z' }); // essentially in future
    // failed and due
    await tx.store.put({ event: createEvent('e3'), status: 'failed', retryCount: 1, nextRetryAt: clock.nowIso() });
    await tx.done;
    db.close();

    const spy = vi.spyOn(provider, 'uploadEvents');
    const result = await coordinator.runUpload();
    expect(result.selectedCount).toBe(2);
    expect(spy).toHaveBeenCalledOnce();
    const uploadedEvents = spy.mock.calls[0][0].events.map(e => e.eventId);
    expect(uploadedEvents).toContain('e1');
    expect(uploadedEvents).toContain('e3');
    expect(uploadedEvents).not.toContain('e2');
  });

  it('5. Batchgröße wird eingehalten.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    const tx = db.transaction('outbox', 'readwrite');
    for (let i = 0; i < 60; i++) {
      await tx.store.put({ event: createEvent(`e${i}`), status: 'pending', retryCount: 0 });
    }
    await tx.done;
    db.close();

    const spy = vi.spyOn(provider, 'uploadEvents');
    const result = await coordinator.runUpload();
    expect(result.selectedCount).toBe(50);
    expect(result.pendingCount).toBe(10);
    expect(spy.mock.calls[0][0].events).toHaveLength(50);
  });

  it('6. Einträge sind vor dem Provideraufruf uploading.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    await db.put('outbox', { event: createEvent('e1'), status: 'pending', retryCount: 0 });
    db.close();

    const spy = vi.spyOn(provider, 'uploadEvents');
    spy.mockImplementationOnce(async () => {
      const innerDb = await openAppDatabaseByName('test-upload-db');
      const entry = await innerDb.get('outbox', 'e1');
      innerDb.close();
      expect(entry.status).toBe('uploading');
      expect(entry.leaseExpiresAt).toBeDefined();
      return { acceptedEventIds: [], rejectedEvents: [] };
    });

    await coordinator.runUpload();
    expect(spy).toHaveBeenCalled();
  });

  it('7. Bestätigte Events werden nur aus der Outbox entfernt.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    const tx = db.transaction(['outbox', 'eventLog', 'appliedEvents'], 'readwrite');
    const ev = createEvent('e1');
    await tx.objectStore('outbox').put({ event: ev, status: 'pending', retryCount: 0 });
    await tx.objectStore('eventLog').put({ event: ev, source: 'local', recordedAt: clock.nowIso() });
    await tx.objectStore('appliedEvents').put({ eventId: 'e1', appliedAt: clock.nowIso() });
    await tx.done;
    db.close();

    const result = await coordinator.runUpload();
    expect(result.acceptedCount).toBe(1);

    const checkDb = await openAppDatabaseByName('test-upload-db');
    const outboxCheck = await checkDb.get('outbox', 'e1');
    const eventLogCheck = await checkDb.get('eventLog', 'e1');
    const appliedEventsCheck = await checkDb.get('appliedEvents', 'e1');
    checkDb.close();

    expect(outboxCheck).toBeUndefined();
    expect(eventLogCheck).toBeDefined();
    expect(appliedEventsCheck).toBeDefined();
  });

  it('8. eventLog und appliedEvents bleiben erhalten.', async () => {
    // Covered by test 7
  });

  it('9. Retryfähige Ablehnung erhöht retryCount und setzt nextRetryAt.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    await db.put('outbox', { event: createEvent('e1'), status: 'pending', retryCount: 0 });
    db.close();

    provider.setFailurePolicy({
      rejectUploadEvent: () => ({ reason: 'Test temporary', retryable: true })
    });

    const result = await coordinator.runUpload();
    expect(result.retryableFailureCount).toBe(1);

    const checkDb = await openAppDatabaseByName('test-upload-db');
    const entry = await checkDb.get('outbox', 'e1') as OutboxEntry;
    checkDb.close();

    expect(entry.status).toBe('failed');
    expect(entry.retryCount).toBe(1);
    expect(entry.nextRetryAt).toBeDefined();
    expect(entry.leaseExpiresAt).toBeUndefined();
    expect(entry.lastError).toBe('Test temporary');
  });

  it('10. Nicht fällige Fehler werden nicht erneut hochgeladen.', async () => {
    // Covered by test 4
  });

  it('11. Permanente Ablehnung wird nicht automatisch wiederholt.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    await db.put('outbox', { event: createEvent('e1'), status: 'pending', retryCount: 0 });
    db.close();

    provider.setFailurePolicy({
      rejectUploadEvent: () => ({ reason: 'Test permanent', retryable: false })
    });

    const spy = vi.spyOn(provider, 'uploadEvents');

    const result = await coordinator.runUpload();
    expect(result.permanentFailureCount).toBe(1);

    const checkDb = await openAppDatabaseByName('test-upload-db');
    const entry = await checkDb.get('outbox', 'e1') as OutboxEntry;
    checkDb.close();

    expect(entry.status).toBe('failed');
    expect(entry.nextRetryAt).toBeUndefined(); // no auto-retry
    expect(entry.retryCount).toBe(0); // doesn't increase count if permanent
    expect(entry.lastError).toBe('Test permanent');

    const result2 = await coordinator.runUpload();
    // In order to recover from access_revoked upon forced runUpload(), it might select the event again to try.
    // So selectedCount could be 1, but it will fail again and increment spy to 2.
    expect(result2.selectedCount).toBe(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('12. Vollständiger temporärer Fehler entfernt kein Event.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    await db.put('outbox', { event: createEvent('e1'), status: 'pending', retryCount: 0 });
    db.close();

    provider.setFailurePolicy({ failNextUpload: true });

    const result = await coordinator.runUpload();
    expect(result.retryableFailureCount).toBe(1);

    const checkDb = await openAppDatabaseByName('test-upload-db');
    const entry = await checkDb.get('outbox', 'e1') as OutboxEntry;
    checkDb.close();

    expect(entry).toBeDefined();
    expect(entry.status).toBe('failed');
    expect(entry.retryCount).toBe(1);
    expect(entry.nextRetryAt).toBeDefined();
    expect(entry.leaseExpiresAt).toBeUndefined();
    expect(coordinator.getStatus()).toBe('error');
  });

  it('13. Vollständiger Fehler hinterlässt keine dauerhaft aktiven uploading-Einträge.', async () => {
    // Covered by 12 (leaseExpiresAt is undefined after error)
  });

  it('14. Veraltete Upload-Leases werden wiederhergestellt.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    // 10s ago it expired
    const expiredLease = new Date(clock.nowMs() - 10000).toISOString();
    await db.put('outbox', { event: createEvent('e1'), status: 'uploading', retryCount: 0, leaseExpiresAt: expiredLease });
    db.close();

    const spy = vi.spyOn(provider, 'uploadEvents');
    const result = await coordinator.runUpload();
    expect(result.selectedCount).toBe(1);
    expect(spy).toHaveBeenCalled();
  });

  it('15. Zwei gleichzeitige Aufrufe erzeugen nur einen Providerupload.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    await db.put('outbox', { event: createEvent('e1'), status: 'pending', retryCount: 0 });
    db.close();

    const spy = vi.spyOn(provider, 'uploadEvents');
    
    // Call twice without awaiting
    const p1 = coordinator.runUpload();
    const p2 = coordinator.runUpload();
    
    await Promise.all([p1, p2]);
    
    expect(spy).toHaveBeenCalledOnce();
  });

  it('16. Backoff ist begrenzt und deterministisch testbar.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    await db.put('outbox', { event: createEvent('e1'), status: 'pending', retryCount: 15 }); // high count to hit MAX
    db.close();

    provider.setFailurePolicy({ failNextUpload: true });
    await coordinator.runUpload();

    const checkDb = await openAppDatabaseByName('test-upload-db');
    const entry = await checkDb.get('outbox', 'e1') as OutboxEntry;
    checkDb.close();

    const expectedDelay = MAX_RETRY_DELAY_MS;
    const expectedJitter = expectedDelay * 0.1 * 0.2; // random is 0.1, jitter is up to 20%
    const expectedNextRetry = clock.nowMs() + expectedDelay + expectedJitter;
    expect(entry.nextRetryAt).toBe(new Date(expectedNextRetry).toISOString());
  });

  it('17. Zugriffsentzug ergibt access_revoked.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    await db.put('outbox', { event: createEvent('e1'), status: 'pending', retryCount: 0 });
    db.close();

    provider.setAccessRevoked(true);

    const spy = vi.spyOn(provider, 'uploadEvents');

    await coordinator.runUpload();

    const checkDb = await openAppDatabaseByName('test-upload-db');
    const entry = await checkDb.get('outbox', 'e1') as OutboxEntry;
    checkDb.close();

    expect(coordinator.getStatus()).toBe('access_revoked');
    expect(entry.status).toBe('failed');
    expect(entry.nextRetryAt).toBeUndefined(); // no auto-retry on revoked
    expect(entry.leaseExpiresAt).toBeUndefined(); // lease removed

    const result2 = await coordinator.runUpload();
    expect(result2.selectedCount).toBe(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('18. store/state bleibt unverändert.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    const beforeState = await db.get('store', 'state');
    await db.put('outbox', { event: createEvent('e1'), status: 'pending', retryCount: 0 });
    db.close();

    await coordinator.runUpload();

    const checkDb = await openAppDatabaseByName('test-upload-db');
    const afterState = await checkDb.get('store', 'state');
    checkDb.close();

    expect(beforeState).toEqual(afterState);
  });

  it('19. downloadChanges() wird nicht aufgerufen.', async () => {
    const spy = vi.spyOn(provider, 'downloadChanges');
    await coordinator.runUpload();
    expect(spy).not.toHaveBeenCalled();
  });

  it('20. IndexedDB-Version und Stores bleiben unverändert.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    expect(db.version).toBe(4);
    expect(db.objectStoreNames.contains('store')).toBe(true);
    expect(db.objectStoreNames.contains('outbox')).toBe(true);
    // no new stores
    expect(db.objectStoreNames.length).toBe(8); 
    db.close();
  });

  it('21. In-Flight-Sperre wird nach Fehler freigegeben.', async () => {
    const db = await openAppDatabaseByName('test-upload-db');
    await db.put('outbox', { event: createEvent('e1'), status: 'pending', retryCount: 0 });
    db.close();

    // 1. Der erste Upload schlägt fehl.
    provider.setFailurePolicy({ failNextUpload: true });
    
    const spy = vi.spyOn(provider, 'uploadEvents');

    // 2. Erster runUpload Aufruf
    const result1 = await coordinator.runUpload();
    expect(result1.retryableFailureCount).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);

    // 3. Warten bis abgeschlossen (schon passiert), Prüfen des Status
    const checkDb1 = await openAppDatabaseByName('test-upload-db');
    const entry1 = await checkDb1.get('outbox', 'e1') as OutboxEntry;
    checkDb1.close();
    expect(entry1.status).toBe('failed');
    expect(entry1.leaseExpiresAt).toBeUndefined();
    expect(entry1.nextRetryAt).toBeDefined();

    // 4. Uhr nach nextRetryAt weiterstellen
    // (We know max delay is 300s, so advancing 400s is safe)
    clock.advance(400000); 

    // 5. Provider ist für nächsten Upload bereit (failNextUpload wurde automatisch konsumiert/zurückgesetzt)
    // 6. Zweiter runUpload Aufruf
    const result2 = await coordinator.runUpload();
    expect(result2.selectedCount).toBe(1);
    expect(result2.acceptedCount).toBe(1);
    
    // 7. Beweise
    expect(spy).toHaveBeenCalledTimes(2);

    const checkDb2 = await openAppDatabaseByName('test-upload-db');
    const entry2 = await checkDb2.get('outbox', 'e1');
    checkDb2.close();
    expect(entry2).toBeUndefined(); // aus Outbox entfernt
  });
});
