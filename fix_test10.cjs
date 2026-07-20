const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  `    let errorThrown = false;
    try {
      await devA.coord.runSync();
    } catch (e) {
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);`,
  `    const runRes = await devA.coord.runSync();
    expect(runRes.errors.length).toBeGreaterThan(0);`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
