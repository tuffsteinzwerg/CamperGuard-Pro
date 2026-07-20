// @ts-nocheck

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SyncCoordinator } from '../syncCoordinator';
import { LoopbackSyncProvider, InMemoryLoopbackBackend } from '../loopbackProvider';
import { IDBSyncStateRepository } from '../syncRepositories';
import { InventoryEvent, AppState } from '../../types';
import * as dbModule from '../appDatabase';
import { deleteDB } from 'idb';
import "fake-indexeddb/auto";
import { runSerializedAppWrite } from '../syncRepository';

describe('SyncCoordinator End-to-End', () => {
  let globalBackend: InMemoryLoopbackBackend;
  
  let clock = {
    time: 1000,
    nowIso() { return new Date(this.time++).toISOString(); },
    nowMs() { return this.time++; }
  };

  beforeEach(async () => {
    await deleteDB('deviceA');
    await deleteDB('deviceB');
    globalBackend = new InMemoryLoopbackBackend();
    clock.time = 1000;
  });

  afterEach(async () => {
    await deleteDB('deviceA');
    await deleteDB('deviceB');
  });

  const createTestDevice = (dbName: string, providerId: string) => {
    const provider = new LoopbackSyncProvider(globalBackend);
    (provider as any).providerId = providerId;
    const repo = new IDBSyncStateRepository(dbName);
    
    let writeQueue = Promise.resolve();
    const dbProvider = {
      openAppDatabase: () => dbModule.openAppDatabaseByName(dbName),
      runSerializedAppWrite: <T>(task: () => Promise<T>): Promise<T> => {
        return new Promise((resolve, reject) => {
          writeQueue = writeQueue.then(async () => {
            try {
              const result = await task();
              resolve(result);
            } catch (err) {
              reject(err);
            }
          });
        });
      }
    };
    
    const coord = new SyncCoordinator(provider, repo, clock, Math.random, dbProvider);
    
    const helpers = {
      coord,
      dbProvider,
      getInventory: async () => {
        const db = await dbProvider.openAppDatabase();
        const state = await db.transaction('store').objectStore('store').get('state');
        db.close();
        return state?.inventory || [];
      },
      getOutbox: async () => {
        const db = await dbProvider.openAppDatabase();
        const all = await db.transaction('outbox').objectStore('outbox').getAll();
        db.close();
        return all;
      },
      getDeferred: async () => {
        const db = await dbProvider.openAppDatabase();
        const all = await db.transaction('deferredEvents').objectStore('deferredEvents').getAll();
        db.close();
        return all;
      },
      getEventLog: async () => {
        const db = await dbProvider.openAppDatabase();
        const all = await db.transaction('eventLog').objectStore('eventLog').getAll();
        db.close();
        return all;
      },
      getAppliedEvents: async () => {
        const db = await dbProvider.openAppDatabase();
        const all = await db.transaction('appliedEvents').objectStore('appliedEvents').getAll();
        db.close();
        return all;
      },
      getAppState: async () => {
        const db = await dbProvider.openAppDatabase();
        const state = await db.transaction('store').objectStore('store').get('state');
        db.close();
        return state;
      },
      getSyncConflicts: async () => {
        const db = await dbProvider.openAppDatabase();
        const all = await db.transaction('syncConflicts').objectStore('syncConflicts').getAll();
        db.close();
        return all;
      },
      getSyncState: async () => {
        const db = await dbProvider.openAppDatabase();
        const state = await db.transaction('syncState').objectStore('syncState').get(providerId);
        db.close();
        return state;
      },
      pushOutbox: async (id: string, ev: InventoryEvent) => {
        await dbProvider.runSerializedAppWrite(async () => {
          const db = await dbProvider.openAppDatabase();
          const tx = db.transaction('outbox', 'readwrite');
          await tx.objectStore('outbox').put({
            eventId: id,
            event: ev,
            status: 'pending',
            createdAt: clock.nowIso(),
            retryCount: 0
          });
          await tx.done;
          db.close();
        });
      },
      pushDeferred: async (id: string, ev: InventoryEvent) => {
        await dbProvider.runSerializedAppWrite(async () => {
          const db = await dbProvider.openAppDatabase();
          const tx = db.transaction('deferredEvents', 'readwrite');
          await tx.objectStore('deferredEvents').put({
            eventId: id,
            event: ev,
            firstDeferredAt: clock.nowIso(),
            lastAttemptAt: clock.nowIso(),
            retryCount: 0,
            status: 'pending',
            reason: 'test'
          });
          await tx.done;
          db.close();
        });
      },
      initLocalState: async (inventory: any[] = []) => {
        const db = await dbProvider.openAppDatabase();
        await db.put('syncState', { providerId, initializationState: 'initialized', remoteCursor: '' });
        await db.put('store', { vehicleId: 'v1', inventory, inventoryRevision: 1 } as AppState, 'state');
        db.close();
      }
    };
    return helpers;
  };

  it('1. Grundsynchronisation A -> B und Rückrichtung', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    const devB = createTestDevice('deviceB', 'provB');

    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();

    await devB.coord['provider'].connect();
    await devB.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devB.initLocalState();

    await devA.pushOutbox('e1', { eventId: 'e1', type: 'item_created', itemId: 'item1', payload: { name: 'Zelt', quantity: 1 }, vehicleId: 'v1', actorId: 'actorA', deviceId: 'deviceA', schemaVersion: 1, timestamp: clock.nowIso() });
    
    let resA = await devA.coord.runSync();
    expect(resA.upload?.acceptedCount).toBe(1);

    let resB = await devB.coord.runSync();
    expect(resB.download?.appliedCount).toBe(1);

    let invB = await devB.getInventory();
    expect(invB).toHaveLength(1);
    expect(invB[0].name).toBe('Zelt');
    
    let outboxB = await devB.getOutbox();
    expect(outboxB).toHaveLength(0);

    await devB.pushOutbox('e3_2', { eventId: 'e3_2', type: 'quantity_delta', itemId: 'item1', payload: { delta: 1 }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'actorB', deviceId: 'deviceB', schemaVersion: 1, timestamp: clock.nowIso() });

    resB = await devB.coord.runSync();
    expect(resB.upload?.acceptedCount).toBe(1);

    resA = await devA.coord.runSync();
    expect(resA.download?.appliedCount).toBe(1);
    
    let invA = await devA.getInventory();
    expect(invA[0].quantity).toBe(2);
  });

  it('3. Gleichzeitige Mengendeltas', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    const devB = createTestDevice('deviceB', 'provB');

    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState([{ id: 'item1', name: 'Zelt', quantity: 2, version: 1 }]);

    await devB.coord['provider'].connect();
    await devB.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devB.initLocalState([{ id: 'item1', name: 'Zelt', quantity: 2, version: 1 }]);

    await devA.pushOutbox('e3_1', { eventId: 'e3_1', type: 'quantity_delta', itemId: 'item1', payload: { delta: 1 }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'actorA', deviceId: 'deviceA', schemaVersion: 1, timestamp: clock.nowIso() });
    await devA.coord.runSync();

    await devB.pushOutbox('e2', { eventId: 'e2', type: 'quantity_delta', itemId: 'item1', payload: { delta: 3 }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'actorB', deviceId: 'deviceB', schemaVersion: 1, timestamp: clock.nowIso() });
    await devB.coord.runSync();

    await devA.coord.runSync();

    let invA = await devA.getInventory();
    let invB = await devB.getInventory();

    expect(invA[0].quantity).toBe(6);
    expect(invB[0].quantity).toBe(6);
  });

  it('4. Tombstone und Wiederherstellung', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    const devB = createTestDevice('deviceB', 'provB');

    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState([{ id: 'item1', name: 'Zelt', quantity: 2, version: 1 }]);

    await devB.coord['provider'].connect();
    await devB.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devB.initLocalState([{ id: 'item1', name: 'Zelt', quantity: 2, version: 1 }]);

    await devA.pushOutbox('e4_1', { eventId: 'e4_1', type: 'item_removed', itemId: 'item1', payload: {}, vehicleId: 'v1', actorId: 'actorA', deviceId: 'deviceA', schemaVersion: 1, timestamp: clock.nowIso() });
    await devA.coord.runSync();

    await devB.pushOutbox('e4_2', { eventId: 'e4_2', type: 'item_updated', itemId: 'item1', payload: { name: 'Zelt2' }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'actorB', deviceId: 'deviceB', schemaVersion: 1, timestamp: clock.nowIso() });
    let res = await devB.coord.runSync();
    
    let invB = await devB.getInventory();
    expect(invB[0].deletedAt).toBeDefined();
    
    await devB.pushOutbox('e4_3', { eventId: 'e4_3', type: 'item_restored', itemId: 'item1', payload: {}, vehicleId: 'v1', actorId: 'actorB', deviceId: 'deviceB', schemaVersion: 1, timestamp: clock.nowIso() });
    await devB.coord.runSync();

    invB = await devB.getInventory();
    expect(invB[0].deletedAt).toBeUndefined();
  });

  it('5. Deferred-Auflösung', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();

    await devA.pushDeferred('e5_1', { eventId: 'e5_1', type: 'item_updated', itemId: 'item1', payload: { name: 'Zelt2' }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'actorB', deviceId: 'deviceB', schemaVersion: 1, timestamp: clock.nowIso() });

    let res = await devA.coord.runDeferredProcessing();
    expect(res.stillDeferredCount).toBe(1);
    
    const e0: InventoryEvent = { eventId: 'e5_0', type: 'item_created', itemId: 'item1', payload: { name: 'Zelt', quantity: 1 }, vehicleId: 'v1', actorId: 'actorB', deviceId: 'deviceB', schemaVersion: 1, timestamp: clock.nowIso() };
    const devB = createTestDevice('deviceB', 'provB');
    await devB.initLocalState();
    await devB.pushOutbox('e5_0', e0);
    await devB.coord['provider'].connect();
    await devB.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devB.coord.runSync();

    res = await devA.coord.runSync();
    expect(res.download?.appliedCount).toBe(1);
    expect(res.deferred?.appliedCount).toBe(1);

    let invA = await devA.getInventory();
    expect(invA[0].name).toBe('Zelt2');
  });
  
  it('6. Dauerhaft nicht auflösbares Deferred-Event', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();

    await devA.pushDeferred('e6_1', { eventId: 'e6_1', type: 'item_updated', itemId: 'item1', payload: { name: 'Zelt2' }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'actorB', deviceId: 'deviceB', schemaVersion: 1, timestamp: clock.nowIso() });

    for (let i = 0; i < 4; i++) {
        await devA.coord.runDeferredProcessing();
    }
    
    let res = await devA.coord.runDeferredProcessing();
    expect(res.permanentFailureCount).toBe(1);
    
    res = await devA.coord.runDeferredProcessing();
    expect(res.selectedCount).toBe(0);
  });
  
  it('7. Parallele Änderung während eines Tombstones (Konflikt)', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    const devB = createTestDevice('deviceB', 'provB');

    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState([{ id: 'item1', name: 'Item', quantity: 1, version: 1 }]);

    await devB.coord['provider'].connect();
    await devB.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devB.initLocalState([{ id: 'item1', name: 'Item', quantity: 1, version: 1 }]);

    await devA.pushOutbox('e7a', { eventId: 'e7a', type: 'item_removed', itemId: 'item1', payload: {}, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() });
    await devA.coord.runSync();

    await devB.pushOutbox('e7b', { eventId: 'e7b', type: 'item_updated', itemId: 'item1', payload: { name: 'Name B' }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'aB', deviceId: 'dB', schemaVersion: 1, timestamp: clock.nowIso() });
    await devB.coord.runSync(); 
    
    const conflicts = await devB.getSyncConflicts();
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
  
  it('8. Nicht kommutative konkurrierende Änderung mit gespeichertem Konflikt', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    const devB = createTestDevice('deviceB', 'provB');

    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState([{ id: 'item1', name: 'Item', quantity: 1, version: 1 }]);

    await devB.coord['provider'].connect();
    await devB.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devB.initLocalState([{ id: 'item1', name: 'Item', quantity: 1, version: 1 }]);

    await devA.pushOutbox('e8a', { eventId: 'e8a', type: 'item_updated', itemId: 'item1', payload: { name: 'Name A' }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() });
    await devA.coord.runSync();

    await devB.pushOutbox('e8b', { eventId: 'e8b', type: 'item_updated', itemId: 'item1', payload: { name: 'Name B' }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'aB', deviceId: 'dB', schemaVersion: 1, timestamp: clock.nowIso() });
    await devB.coord.runSync(); 
    
    const conflicts = await devB.getSyncConflicts();
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].reason).toContain('Base version mismatch');
  });

  it('9. Wiederholungsdownload wendet kein Event doppelt an', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();
    
    await devA.dbProvider.runSerializedAppWrite(async () => {
        const db = await devA.dbProvider.openAppDatabase();
        const tx = db.transaction('appliedEvents', 'readwrite');
        await tx.objectStore('appliedEvents').put({ eventId: 'e10', appliedAt: 'time' });
        await tx.done;
        db.close();
    });

    await devA.coord['provider'].uploadEvents({ vehicleId: 'v1', events: [{ eventId: 'e10', type: 'item_created', itemId: 'item1', payload: { name: 'Item', quantity: 1 }, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() }]});
    
    let res = await devA.coord.runSync();
    expect(res.download?.alreadyAppliedCount).toBe(1);
    expect(res.download?.appliedCount).toBe(0);
  });

    it('10. Abbruch während lokaler Seitenverarbeitung führt zum vollständigen Rollback', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();


    const ev1: InventoryEvent = { eventId: 'err1', type: 'item_created', itemId: 'item1', payload: { name: 'Valid Item', quantity: 1 }, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };
    const ev2: InventoryEvent = { eventId: 'err2', type: 'item_created', itemId: 'item2', payload: { name: 'Valid Item 2', quantity: 1 }, vehicleId: 'v2', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };

    // Inject directly into the backend store to bypass upload validation
    const store = devA.coord['provider']['backend'].getOrCreateStore('v1');
    store.sequence++;
    store.events.push({ event: ev1, remoteMetadata: { providerSequence: store.sequence.toString(), receivedAt: clock.nowIso() } });
    store.sequence++;
    store.events.push({ event: ev2, remoteMetadata: { providerSequence: store.sequence.toString(), receivedAt: clock.nowIso() } });

    
    let runRes = await devA.coord.runSync();
    console.log("DEBUG TEST 10", JSON.stringify(runRes.download));
    expect(runRes.download?.appliedCount).toBe(0);

    const appState = await devA.getAppState();
    expect(appState.inventory).toHaveLength(0);
    expect((await devA.getSyncState()).remoteCursor).toBe('');
    expect(await devA.getEventLog()).toHaveLength(0);
    expect(await devA.getAppliedEvents()).toHaveLength(0);
    expect(await devA.getDeferred()).toHaveLength(0);
    expect(await devA.getSyncConflicts()).toHaveLength(0);

    // Fix ev2 to be valid for next try
    ev2.vehicleId = 'v1';
    
    const store2 = devA.coord['provider']['backend'].getStore('v1');
    store2.events[1].event.vehicleId = 'v1';

    console.log("STORE EVENTS BEFORE SECOND RUN", JSON.stringify(devA.coord['provider']['backend'].getStore('v1')));
    const res = await devA.coord.runSync();
    console.log("DEBUG TEST 10 SECOND RUN", JSON.stringify(res));
    expect(res.download?.appliedCount).toBe(2);
    
    expect((await devA.getAppState()).inventory).toHaveLength(2);
    expect((await devA.getSyncState()).remoteCursor).not.toBe('');
  });

  it('11. Zwei parallele vollständige runSync()-Aufrufe', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();

    await devA.pushOutbox('e11', { eventId: 'e11', type: 'item_created', itemId: 'item1', payload: { name: 'Zelt', quantity: 1 }, vehicleId: 'v1', actorId: 'actorA', deviceId: 'deviceA', schemaVersion: 1, timestamp: clock.nowIso() });

    const dlSpy = vi.spyOn(devA.coord['provider'], 'downloadChanges');
    const ulSpy = vi.spyOn(devA.coord['provider'], 'uploadEvents');

    let p1 = devA.coord.runSync();
    let p2 = devA.coord.runSync();
    const results = await Promise.all([p1, p2]);

    expect(dlSpy).toHaveBeenCalledTimes(1);
    expect(ulSpy).toHaveBeenCalledTimes(1);
    
    // The second call returns the same result or a neutral result if locked
    expect(results[1]).toBeDefined();
  });

  it('12. In-Flight-Sperre wird nach Fehler freigegeben', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();

    vi.spyOn(devA.coord['provider'], 'downloadChanges').mockRejectedValueOnce(new Error('Network error'));
    
    await devA.coord.runSync().catch(() => {});
    
    vi.spyOn(devA.coord['provider'], 'downloadChanges').mockResolvedValueOnce({ events: [], newCursor: '', hasMore: false });
    let res = await devA.coord.runSync();
    expect(res.download).toBeDefined();
  });

  it('13. Zugriffsentzug erhält lokale Daten und Outbox', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();
    await devA.pushOutbox('e15', { eventId: 'e15', type: 'item_created', itemId: 'item1', payload: { name: 'Item', quantity: 1 }, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() });
    
    devA.coord['provider'].setAccessRevoked(true); // Simulates access revoked
    
    let errRes;
    try {
        await devA.coord.runSync();
    } catch(err: any) {
        errRes = err;
    }
    
    const outbox = await devA.getOutbox();
    expect(outbox).toHaveLength(1);
    
    const syncState = await devA.getSyncState();
    expect(syncState.remoteCursor).toBe('');
    
    const appState = await devA.getAppState();
    expect(appState.inventory).toHaveLength(0);
  });

  it('14. Fahrzeugfremde Events werden als permanent_failure markiert', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();
    
    await devA.pushDeferred('ex', { eventId: 'ex', type: 'item_updated', itemId: 'item1', payload: { name: 'Item' }, baseItemVersion: 1, vehicleId: 'v2', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() });
    
    let res = await devA.coord.runDeferredProcessing();
    expect(res.permanentFailureCount).toBe(1);
    
    let defs = await devA.getDeferred();
    expect(defs[0].status).toBe('permanent_failure');

    res = await devA.coord.runDeferredProcessing();
    expect(res.selectedCount).toBe(0);
    expect(res.permanentFailureCount).toBe(0);
  });

  it('15. Deferred-Event wird nach Eintreffen der Voraussetzung aufgelöst (Atomarität)', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();

    await devA.pushDeferred('e8_2', { eventId: 'e8_2', type: 'item_updated', itemId: 'item1', payload: { name: 'Item' }, baseItemVersion: 1, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() });
    await devA.coord.runDeferredProcessing();
    let defs = await devA.getDeferred();
    expect(defs[0].status).toBe('pending');
    expect(defs[0].retryCount).toBe(1);

    await devA.dbProvider.runSerializedAppWrite(async () => {
      const db = await devA.dbProvider.openAppDatabase();
      await db.put('store', { vehicleId: 'v1', inventory: [{ id: 'item1', name: 'Old', quantity: 1, version: 1 }], inventoryRevision: 2 } as AppState, 'state');
      db.close();
    });

    await devA.coord.runDeferredProcessing();
    
    defs = await devA.getDeferred();
    expect(defs).toHaveLength(0);
    const inv = await devA.getInventory();
    expect(inv[0].name).toBe('Item');
    
    const applied = await devA.getAppliedEvents();
    expect(applied.find(e => e.eventId === 'e8_2')).toBeDefined();
  });
  
  it('16. Nach Wiederfreigabe kann weiter synchronisiert werden', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();
    
    await devA.pushOutbox('e16', { eventId: 'e16', type: 'item_created', itemId: 'item1', payload: { name: 'New Item', quantity: 1 }, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() });
    
    devA.coord['provider'].setAccessRevoked(true);
    
    await devA.coord.runSync();
    
    expect((await devA.getOutbox())).toHaveLength(1);
    
    devA.coord['provider'].setAccessRevoked(false);
    await devA.coord.runSync();
    
    expect((await devA.getOutbox())).toHaveLength(0);
    expect((await devA.getSyncState()).remoteCursor).not.toBe('');
  });
});
