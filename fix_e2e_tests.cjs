const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  `devA.coord['provider'].disconnect(); // Simulates access revoked`,
  `devA.coord['provider'].setAccessRevoked(true); // Simulates access revoked`
);

code = code.replace(
  `        let errRes;
    try {
        await devA.coord.runSync();
    } catch(err: any) {
        errRes = err;
    }
    
    const outbox = await devA.getOutbox();`,
  `        const res = await devA.coord.runSync();
    expect(res.upload.selectedCount).toBe(0); // Should fail early
    
    const outbox = await devA.getOutbox();`
);

code = code.replace(
  `    devA.coord['provider'].disconnect();
    
    try {
        await devA.coord.runSync();
    } catch(e) {}
    
    expect((await devA.getOutbox())).toHaveLength(1);
    
    await devA.coord['provider'].connect();`,
  `    devA.coord['provider'].setAccessRevoked(true);
    
    await devA.coord.runSync();
    
    expect((await devA.getOutbox())).toHaveLength(1);
    
    devA.coord['provider'].setAccessRevoked(false);`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
