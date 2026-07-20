const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');

// Replace new SyncCoordinator with dbProvider
code = code.replace(
  `    const random = () => 0.1;
    coordinator = new SyncCoordinator(provider, stateRepo, clock, random);`,
  `    const random = () => 0.1;
    
    let dbQueue = Promise.resolve();
    const dbProvider = {
      openAppDatabase: () => openAppDatabaseByName('test-download-db'),
      runSerializedAppWrite: (task) => {
        return new Promise((resolve, reject) => {
          dbQueue = dbQueue.then(async () => {
            try { resolve(await task()); } catch(e) { reject(e); }
          });
        });
      }
    };
    coordinator = new SyncCoordinator(provider, stateRepo, clock, random, dbProvider);`
);

// Replace openAppDatabase() with dbProvider.openAppDatabase()
code = code.replace(/openAppDatabase\(\)/g, "openAppDatabaseByName('test-download-db')");

fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', code);
