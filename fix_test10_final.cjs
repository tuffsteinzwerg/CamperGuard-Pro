const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  `    store.events.push({ event: ev1, cursor: store.sequence.toString(), receivedAt: clock.nowIso() });
    store.sequence++;
    store.events.push({ event: ev2, cursor: store.sequence.toString(), receivedAt: clock.nowIso() });`,
  `    store.events.push({ event: ev1, remoteMetadata: { providerSequence: store.sequence.toString(), receivedAt: clock.nowIso() } });
    store.sequence++;
    store.events.push({ event: ev2, remoteMetadata: { providerSequence: store.sequence.toString(), receivedAt: clock.nowIso() } });`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
