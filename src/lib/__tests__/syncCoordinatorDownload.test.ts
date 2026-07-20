import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncCoordinator, DefaultSyncCoordinatorClock } from '../syncCoordinator';
import { LoopbackSyncProvider, InMemoryLoopbackBackend } from '../loopbackProvider';
import { IDBSyncStateRepository } from '../syncRepositories';
import { openAppDatabase, openAppDatabaseByName } from '../appDatabase';
import { InventoryEvent, LocalSyncState, AppState } from '../../types';
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

function createRemoteEvent(id: string, type: any = 'item_created', payload: any = { name: 'Item ' + id }, vId: string = 'v1'): InventoryEvent {
  return {
    eventId: id,
    type: type,
    itemId: 'item_' + id,
    vehicleId: vId,
    actorId: 'a2',
    deviceId: 'd2',
    clientCreatedAt: '2023-01-01T00:00:00.000Z',
    schemaVersion: 1,
    payload
  } as InventoryEvent;
}

describe('SyncCoordinator Download', () => {
  let backend: InMemoryLoopbackBackend;
  let provider: LoopbackSyncProvider;
  let stateRepo: IDBSyncStateRepository;
  let clock: TestClock;
  let coordinator: SyncCoordinator;

  beforeEach(async () => {
    backend = new InMemoryLoopbackBackend();
    provider = new LoopbackSyncProvider(backend);
    stateRepo = new IDBSyncStateRepository('test-download-db');
    clock = new TestClock();
    
    const random = () => 0.1;
    
    const { runSerializedAppWrite: actualRun } = await import('../syncRepository');
    const dbProvider = {
      openAppDatabase: () => openAppDatabaseByName('test-download-db'),
      runSerializedAppWrite: <T>(task: any) => actualRun(task) as Promise<T>
    };
    coordinator = new SyncCoordinator(provider, stateRepo, clock, random, dbProvider);

    const db = await openAppDatabaseByName('test-download-db');
    const tx = db.transaction(['store', 'outbox', 'eventLog', 'appliedEvents', 'syncState', 'deferredEvents', 'syncConflicts'], 'readwrite');
    await tx.objectStore('store').clear();
    await tx.objectStore('outbox').clear();
    await tx.objectStore('eventLog').clear();
    await tx.objectStore('appliedEvents').clear();
    await tx.objectStore('syncState').clear();
    await tx.objectStore('deferredEvents').clear();
    await tx.objectStore('syncConflicts').clear();
    
    await tx.objectStore('store').put({ vehicleId: 'v1', inventory: [], inventoryRevision: 0 } as AppState, 'state');
    await tx.objectStore('syncState').put({ providerId: 'loopback', initializationState: 'ready' } as LocalSyncState);
    await tx.done;
    await provider.connect();
    await provider.initializeRemoteStore({ vehicleId: 'v1' });
    db.close();

    await provider.connect();
    await provider.initializeRemoteStore({ vehicleId: 'v1' });
  });

  it('1. requires_initialization verhindert Download.', async () => {
    await stateRepo.save({ providerId: 'loopback', initializationState: 'requires_initialization' });
    const spy = vi.spyOn(provider, 'downloadChanges');
    const result = await coordinator.runDownload();
    expect(result.pageCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    expect(coordinator.getStatus()).toBe('requires_initialization');
  });

  it('2. Getrennter Provider verhindert Download.', async () => {
    await provider.disconnect();
    const spy = vi.spyOn(provider, 'downloadChanges');
    const result = await coordinator.runDownload();
    expect(result.pageCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    expect(coordinator.getStatus()).toBe('disconnected');
  });

  it('3. Zugriffsentzug liefert strukturierten Status.', async () => {
    provider.setAccessRevoked(true);
    const spy = vi.spyOn(provider, 'downloadChanges');
    const result = await coordinator.runDownload();
    expect(result.pageCount).toBe(0);
    expect(spy).toHaveBeenCalled();
    expect(coordinator.getStatus()).toBe('access_revoked');
  });

  it('4. Download ohne neue Events verändert nichts.', async () => {
    const result = await coordinator.runDownload();
    expect(result.downloadedCount).toBe(0);
    expect(result.appliedCount).toBe(0);
    
    const db = await openAppDatabaseByName('test-download-db');
    const state = await db.get('store', 'state');
    const events = await db.getAll('eventLog');
    db.close();

    expect(state.inventory.length).toBe(0);
    expect(events.length).toBe(0);
  });

  it('5. Download startet mit gespeichertem Cursor.', async () => {
    await stateRepo.save({ providerId: 'loopback', initializationState: 'ready', remoteCursor: 'test-cursor' });
    const spy = vi.spyOn(provider, 'downloadChanges');
    await coordinator.runDownload();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'test-cursor' }));
  });

  it('6. Mehrere Seiten werden vollständig verarbeitet.', async () => {
    for (let i = 0; i < 150; i++) {
      await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent(`e${i}`)] });
    }
    
    const result = await coordinator.runDownload();
    expect(result.downloadedCount).toBe(150);
    expect(result.appliedCount).toBe(150);
    expect(result.pageCount).toBeGreaterThanOrEqual(2);
  });

  it('7. Remote-Reihenfolge bleibt erhalten.', async () => {
    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e2')] });
    
    await coordinator.runDownload();
    
    const db = await openAppDatabaseByName('test-download-db');
    const events = await db.getAll('eventLog');
    db.close();

    expect(events.length).toBe(2);
    expect(events[0].event.eventId).toBe('e1');
    expect(events[1].event.eventId).toBe('e2');
  });

  it('8. Unveränderter Cursor bei hasMore === true bricht kontrolliert ab.', async () => {
    vi.spyOn(provider, 'downloadChanges').mockResolvedValueOnce({
      events: [],
      hasMore: true,
      newCursor: undefined // Same as start
    });
    const result = await coordinator.runDownload();
    expect(result.pageCount).toBe(1);
    expect(coordinator.getStatus()).toBe('error');
  });

  it('9. Bereits angewendete Events werden nicht erneut angewendet.', async () => {
    const db = await openAppDatabaseByName('test-download-db');
    await db.put('appliedEvents', { eventId: 'e1', appliedAt: clock.nowIso() });
    db.close();

    const upRes = await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    console.log("TEST 9 UPLOAD", upRes);
    const result = await coordinator.runDownload();
    console.log("TEST 9 DOWNLOAD", result);
    expect(result.alreadyAppliedCount).toBe(1);
    expect(result.appliedCount).toBe(0);
  });

  it('10. Erfolgreiche Remote-Events verändern den AppState genau einmal.', async () => {
    const r = await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    console.log("UPLOAD RESULT", r);
    const dr = await coordinator.runDownload();
    console.log("DOWNLOAD RESULT", dr);

    const db = await openAppDatabaseByName('test-download-db');
    const state = await db.get('store', 'state');
    db.close();

    expect(state.inventory).toHaveLength(1);
    expect(state.inventoryRevision).toBe(1);
  });

  it('11. Erfolgreiche Remote-Events werden mit source: "remote" im eventLog gespeichert.', async () => {
    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    await coordinator.runDownload();

    const db = await openAppDatabaseByName('test-download-db');
    const eventLog = await db.get('eventLog', 'e1');
    db.close();

    expect(eventLog).toBeDefined();
    expect(eventLog.source).toBe('remote');
  });

  it('12. Remote-Events gelangen niemals in die Outbox.', async () => {
    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    await coordinator.runDownload();

    const db = await openAppDatabaseByName('test-download-db');
    const outbox = await db.getAll('outbox');
    db.close();

    expect(outbox).toHaveLength(0);
  });

  it('13. Erfolgreiche Events werden in appliedEvents markiert.', async () => {
    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    await coordinator.runDownload();

    const db = await openAppDatabaseByName('test-download-db');
    const applied = await db.get('appliedEvents', 'e1');
    db.close();

    expect(applied).toBeDefined();
  });

  it('14. Deferred-Events werden gespeichert, aber nicht erneut verarbeitet.', async () => {
    // an item_updated event for a non-existing item will be deferred
    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1', 'item_updated')] });
    const result = await coordinator.runDownload();

    expect(result.deferredCount).toBe(1);

    const db = await openAppDatabaseByName('test-download-db');
    const def = await db.get('deferredEvents', 'e1');
    const state = await db.get('store', 'state');
    db.close();

    expect(def).toBeDefined();
    expect(state.inventory).toHaveLength(0); // Not applied
  });

  it('15. Konflikte werden gespeichert.', async () => {
    // Create local item
    const db = await openAppDatabaseByName('test-download-db');
    let state = await db.get('store', 'state');
    state.inventory.push({ id: 'item_e1', version: 2, name: 'Local' });
    await db.put('store', state, 'state');
    db.close();

    // Remote event with baseItemVersion 1 (mismatch with 2)
    const remoteEv = createRemoteEvent('e1', 'item_updated', { name: 'Remote' });
    remoteEv.baseItemVersion = 1;
    await provider.uploadEvents({ vehicleId: 'v1', events: [remoteEv] });
    
    const result = await coordinator.runDownload();
    expect(result.conflictCount).toBe(1);

    const checkDb = await openAppDatabaseByName('test-download-db');
    const conflict = await checkDb.get('syncConflicts', 'e1');
    checkDb.close();

    expect(conflict).toBeDefined();
    expect(conflict.status).toBe('open');
  });

  it('16. Abweichende vehicleId wird abgelehnt.', async () => {
    // Initialize v2 so upload doesn't fail
    await provider.initializeRemoteStore({ vehicleId: 'v2' });
    await provider.uploadEvents({ vehicleId: 'v2', events: [createRemoteEvent('e1', 'item_created', {}, 'v2')] });
    
    // We mock downloadChanges to return the event with v2, even though we request for v1
    vi.spyOn(provider, 'downloadChanges').mockResolvedValueOnce({
      events: [{ event: createRemoteEvent('e1', 'item_created', {}, 'v2'), remoteMetadata: {} as any }],
      hasMore: false,
      newCursor: 'new-cursor'
    });

    const result = await coordinator.runDownload();
    expect(coordinator.getStatus()).toBe('error');
    
    const db = await openAppDatabaseByName('test-download-db');
    const state = await db.get('store', 'state');
    db.close();
    expect(state.inventory).toHaveLength(0); // Not applied
  });

  it('17. Cursor wird erst nach sicher gespeicherter Seite fortgeschrieben.', async () => {
    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    await coordinator.runDownload();

    const db = await openAppDatabaseByName('test-download-db');
    const syncState = await db.get('syncState', 'loopback');
    db.close();

    expect(syncState.remoteCursor).toBeDefined();
    expect(syncState.remoteCursor).not.toBe('');
  });

  it('18. Lokaler Speicherfehler lässt den Cursor unverändert.', async () => {
    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    
    // Provoke an error by deleting store state during run
    vi.spyOn(provider, 'downloadChanges').mockImplementationOnce(async (req) => {
       const db = await openAppDatabaseByName('test-download-db');
       await db.delete('store', 'state');
       db.close();
       
       // Call real method
       return (provider['backend'] as any).downloadChanges(req.vehicleId, req.cursor, req.limit);
    });

    await coordinator.runDownload();

    const checkDb = await openAppDatabaseByName('test-download-db');
    const syncState = await checkDb.get('syncState', 'loopback');
    checkDb.close();

    expect(syncState.remoteCursor).toBeUndefined();
    expect(coordinator.getStatus()).toBe('error');
  });

  it('19. Vollständiger Providerfehler verändert AppState und Cursor nicht.', async () => {
    provider.setFailurePolicy({ failNextUpload: true }); // doesn't affect download
    vi.spyOn(provider, 'downloadChanges').mockRejectedValue(new Error('Network error'));
    
    await coordinator.runDownload();

    const checkDb = await openAppDatabaseByName('test-download-db');
    const syncState = await checkDb.get('syncState', 'loopback');
    const appState = await checkDb.get('store', 'state');
    checkDb.close();

    expect(syncState.remoteCursor).toBeUndefined();
    expect(appState.inventory).toHaveLength(0);
    expect(coordinator.getStatus()).toBe('error');
  });

  it('20. Zwei parallele Downloadaufrufe erzeugen nur einen Providerdownload.', async () => {
    const spy = vi.spyOn(provider, 'downloadChanges');
    const p1 = coordinator.runDownload();
    const p2 = coordinator.runDownload();
    
    await Promise.all([p1, p2]);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('21. In-Flight-Sperre wird nach Fehler freigegeben.', async () => {
    vi.spyOn(provider, 'downloadChanges').mockRejectedValueOnce(new Error('Temporary error'));
    await coordinator.runDownload();
    expect(coordinator.getStatus()).toBe('error');

    const result = await coordinator.runDownload(); // Should work again
    expect(result.pageCount).toBe(0); // 0 pages because backend is empty
    expect(coordinator.getStatus()).toBe('idle');
  });

  it('22. Bestehende Outbox-Einträge bleiben unverändert.', async () => {
    const db = await openAppDatabaseByName('test-download-db');
    await db.put('outbox', { event: createRemoteEvent('local1'), status: 'pending', retryCount: 0 });
    db.close();

    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    await coordinator.runDownload();

    const checkDb = await openAppDatabaseByName('test-download-db');
    const outbox = await checkDb.getAll('outbox');
    checkDb.close();

    expect(outbox).toHaveLength(1);
    expect(outbox[0].event.eventId).toBe('local1');
  });

  it('23. Uploadlogik aus 3C funktioniert weiterhin.', async () => {
    const db = await openAppDatabaseByName('test-download-db');
    await db.put('outbox', { event: createRemoteEvent('local1'), status: 'pending', retryCount: 0 });
    db.close();

    const result = await coordinator.runUpload();
    expect(result.acceptedCount).toBe(1);
  });

  it('24. IndexedDB-Version bleibt 4.', async () => {
    const db = await openAppDatabaseByName('test-download-db');
    expect(db.version).toBe(4);
    db.close();
  });

  it('25. Es entstehen keine neuen IndexedDB-Stores.', async () => {
    const db = await openAppDatabaseByName('test-download-db');
    expect(db.objectStoreNames.length).toBe(8); 
    db.close();
  });


  it('26. runDownload() wird innerhalb der bestehenden zentralen writeQueue ausgeführt.', async () => {
    let queueExecuted = false;
    vi.spyOn(provider, 'downloadChanges').mockResolvedValueOnce({
      events: [{ event: createRemoteEvent('e1', 'item_created', {}, 'v1'), remoteMetadata: {} as any }],
      hasMore: false,
      newCursor: 'new-cursor'
    });
    // We can simulate an existing promise in the queue
    const { runSerializedAppWrite } = await import('../syncRepository');
    const p = runSerializedAppWrite(async () => {
       await new Promise(resolve => setTimeout(resolve, 50));
       queueExecuted = true;
    });
    
    await coordinator.runDownload();
    expect(queueExecuted).toBe(true);
  });

  it('27. Expliziter Rollback während einer Seite.', async () => {
    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1', 'item_created', {}, 'v1'), createRemoteEvent('e2', 'item_created', {}, 'v1')] });
    
    // Provoke error on second event
    vi.spyOn(provider, 'downloadChanges').mockImplementationOnce(async (req) => {
       const res = await (provider['backend'] as any).downloadChanges(req.vehicleId, req.cursor, req.limit);
       // Malform the second event to trigger an error
       if (res.events.length > 1) {
           res.events[1].event.vehicleId = 'wrong_vehicle';
       }
       return res;
    });

    const result = await coordinator.runDownload();
    expect(coordinator.getStatus()).toBe('error');

    const db = await openAppDatabaseByName('test-download-db');
    const state = await db.get('store', 'state');
    const logs = await db.getAll('eventLog');
    const applied = await db.getAll('appliedEvents');
    db.close();

    // Verify e1 was NOT saved due to tx.abort()
    expect(state.inventory).toHaveLength(0);
    expect(logs).toHaveLength(0);
    expect(applied).toHaveLength(0);
  });

  it('28. Eine nicht leere Seite ohne gültigen fortschreitenden Cursor wird abgelehnt.', async () => {
    vi.spyOn(provider, 'downloadChanges').mockResolvedValueOnce({
      events: [{ event: createRemoteEvent('e1', 'item_created', {}, 'v1'), remoteMetadata: {} as any }],
      hasMore: false,
      newCursor: '' // empty cursor
    });
    const result = await coordinator.runDownload();
    expect(coordinator.getStatus()).toBe('error');
    
    const db = await openAppDatabaseByName('test-download-db');
    const state = await db.get('store', 'state');
    db.close();
    expect(state.inventory).toHaveLength(0);
  });

});
