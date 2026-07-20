const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

const oldTest = `  it('10. Abbruch während lokaler Seitenverarbeitung führt zum vollständigen Rollback', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();

    const ev1: InventoryEvent = { eventId: 'err1', type: 'item_created', itemId: 'item1', payload: { name: 'Valid Item', quantity: 1 }, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };
    const ev2: InventoryEvent = { eventId: 'err2', type: 'item_created', itemId: 'item2', payload: { name: 'Valid Item 2', quantity: 1 }, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };

    await devA.coord['provider'].uploadEvents({ vehicleId: 'v1', events: [ev1, ev2] });
    
    const originalRunWrite = devA.dbProvider.runSerializedAppWrite;
    devA.dbProvider.runSerializedAppWrite = async <T>(task: () => Promise<T>) => {
        return originalRunWrite(async () => {
            const originalOpen = devA.dbProvider.openAppDatabase;
            devA.dbProvider.openAppDatabase = async () => {
                const db = await originalOpen();
                const originalTx = db.transaction.bind(db);
                db.transaction = function(names, mode) {
                    const tx = originalTx(names, mode);
                    const originalObjStore = tx.objectStore.bind(tx);
                    tx.objectStore = function(name) {
                        const store = originalObjStore(name);
                        if (name === 'store') {
                            const originalPut = store.put.bind(store);
                            store.put = function(val, key) {
                                if (val.inventory && val.inventory.length === 2) {
                                    try { tx.abort(); } catch(e) {}
                                    return Promise.reject(new Error('Controlled local storage error during page save'));
                                }
                                return originalPut(val, key);
                            };
                        }
                        return store;
                    };
                    return tx;
                };
                return db;
            };
            try {
                const res = await task();
                devA.dbProvider.openAppDatabase = originalOpen;
                return res;
            } catch (err) {
                devA.dbProvider.openAppDatabase = originalOpen;
                throw err;
            }
        });
    };

    const runRes = await devA.coord.runSync();
    expect(runRes.errors.length).toBeGreaterThan(0);

    const appState = await devA.getAppState();
    expect(appState.inventory).toHaveLength(0);
    expect((await devA.getSyncState()).remoteCursor).toBe('');
    expect(await devA.getEventLog()).toHaveLength(0);
    expect(await devA.getAppliedEvents()).toHaveLength(0);
    expect(await devA.getDeferred()).toHaveLength(0);
    expect(await devA.getSyncConflicts()).toHaveLength(0);

    devA.dbProvider.runSerializedAppWrite = originalRunWrite;

    const res = await devA.coord.runSync();
    expect(res.download?.appliedCount).toBe(2);
    
    expect((await devA.getAppState()).inventory).toHaveLength(2);
    expect((await devA.getSyncState()).remoteCursor).not.toBe('');
  });`;

const newTest = `  it('10. Abbruch während lokaler Seitenverarbeitung führt zum vollständigen Rollback', async () => {
    const devA = createTestDevice('deviceA', 'provA');
    await devA.coord['provider'].connect();
    await devA.coord['provider'].initializeRemoteStore({ vehicleId: 'v1' });
    await devA.initLocalState();

    const ev1: InventoryEvent = { eventId: 'err1', type: 'item_created', itemId: 'item1', payload: { name: 'Valid Item', quantity: 1 }, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };
    const ev2: InventoryEvent = { eventId: 'err2', type: 'item_created', itemId: 'item2', payload: { name: 'Valid Item 2', quantity: 1 }, vehicleId: 'v2', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };

    await devA.coord['provider'].uploadEvents({ vehicleId: 'v1', events: [ev1, ev2] });
    
    let runRes = await devA.coord.runSync();
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
    
    // uploadEvents appends, so we can't easily replace it in LoopbackSyncProvider.
    // We'll just reset the backend.
    await devA.coord['provider'].disconnect();
    devA.coord['provider']['backend'].events['v1'] = [
        { event: ev1, cursor: 'c1' },
        { event: ev2, cursor: 'c2' }
    ];
    await devA.coord['provider'].connect();

    const res = await devA.coord.runSync();
    expect(res.download?.appliedCount).toBe(2);
    
    expect((await devA.getAppState()).inventory).toHaveLength(2);
    expect((await devA.getSyncState()).remoteCursor).not.toBe('');
  });`;

// Because the old code string match might fail if I made a typo in the snippet, 
// let's do a substring replace
const startIndex = code.indexOf("it('10. Abbruch während lokaler Seitenverarbeitung");
const endIndex = code.indexOf("it('11. Zwei parallele");
code = code.substring(0, startIndex) + newTest + "\n\n  " + code.substring(endIndex);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
