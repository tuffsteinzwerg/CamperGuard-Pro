const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');

code = code.replace(
  /let dbQueue = Promise\.resolve\(\);\s*const dbProvider = {[\s\S]*?};\s*coordinator = new SyncCoordinator\(provider, stateRepo, clock, random, dbProvider\);/m,
  `const { runSerializedAppWrite: actualRun } = await import('../syncRepository');
    const dbProvider = {
      openAppDatabase: () => openAppDatabaseByName('test-download-db'),
      runSerializedAppWrite: (task) => actualRun(task)
    };
    coordinator = new SyncCoordinator(provider, stateRepo, clock, random, dbProvider);`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', code);
