const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  "await pushOutbox('e1', { eventId: 'e1', type: 'quantity_delta', itemId: 'item1', payload: { delta: 1 }, vehicleId: 'v1', actorId: 'actorA', deviceId: 'deviceA', schemaVersion: 1, timestamp: clock.nowIso() });\n    await coordA.runSync();",
  "await pushOutbox('e1', { eventId: 'e1', type: 'quantity_delta', itemId: 'item1', payload: { delta: 1 }, vehicleId: 'v1', actorId: 'actorA', deviceId: 'deviceA', schemaVersion: 1, timestamp: clock.nowIso() });\n    console.log('Test 3 outbox before:', await getOutbox());\n    await coordA.runSync();"
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
