const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  "backend['events'].push({ event: e0, remoteMetadata: { receivedAt: clock.nowIso(), providerSequence: '1' } });",
  "currentDevice = 'deviceB';\n    await pushOutbox('e5_0', e0);\n    const coordB = createCoordinator('provB');\n    await coordB['provider'].connect();\n    await coordB['provider'].initializeRemoteStore({ vehicleId: 'v1' });\n    await coordB.runSync();\n    currentDevice = 'deviceA';"
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
