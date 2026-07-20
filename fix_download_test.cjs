const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');

code = code.replace(
  "await tx.objectStore('syncState').put({ providerId: 'loopback', initializationState: 'ready' } as LocalSyncState);\n    await tx.done;",
  "await tx.objectStore('syncState').put({ providerId: 'loopback', initializationState: 'ready' } as LocalSyncState);\n    await tx.done;\n    await provider.connect();\n    await provider.initializeRemoteStore({ vehicleId: 'v1' });"
);

code = code.replace(/^\/\/ @ts-nocheck\n/g, '');

fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', code);
