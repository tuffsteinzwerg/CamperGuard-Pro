const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

const replacement = `
    const ev1: InventoryEvent = { eventId: 'err1', type: 'item_created', itemId: 'item1', payload: { name: 'Valid Item', quantity: 1 }, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };
    const ev2: InventoryEvent = { eventId: 'err2', type: 'item_created', itemId: 'item2', payload: { name: 'Valid Item 2', quantity: 1 }, vehicleId: 'v2', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };

    // Inject directly into the backend store to bypass upload validation
    const store = devA.coord['provider']['backend'].getOrCreateStore('v1');
    store.sequence++;
    store.events.push({ event: ev1, cursor: store.sequence.toString(), receivedAt: clock.nowIso() });
    store.sequence++;
    store.events.push({ event: ev2, cursor: store.sequence.toString(), receivedAt: clock.nowIso() });
`;

// Replace the uploadEvents call in test 10 with the injection
code = code.replace(
  `    const ev1: InventoryEvent = { eventId: 'err1', type: 'item_created', itemId: 'item1', payload: { name: 'Valid Item', quantity: 1 }, vehicleId: 'v1', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };
    const ev2: InventoryEvent = { eventId: 'err2', type: 'item_created', itemId: 'item2', payload: { name: 'Valid Item 2', quantity: 1 }, vehicleId: 'v2', actorId: 'aA', deviceId: 'dA', schemaVersion: 1, timestamp: clock.nowIso() };

    await devA.coord['provider'].uploadEvents({ vehicleId: 'v1', events: [ev1, ev2] });`,
  replacement
);

code = code.replace(
  `    // uploadEvents appends, so we can't easily replace it in LoopbackSyncProvider.
    // We'll just reset the backend.
    await devA.coord['provider'].disconnect();
    devA.coord['provider']['backend'].events['v1'] = [
        { event: ev1, cursor: 'c1' },
        { event: ev2, cursor: 'c2' }
    ];
    await devA.coord['provider'].connect();`,
  `    const store2 = devA.coord['provider']['backend'].getStore('v1');
    store2.events[1].event.vehicleId = 'v1';`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
