const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  `    const res = await devA.coord.runSync();
    expect(res.download?.appliedCount).toBe(2);`,
  `    const res = await devA.coord.runSync();
    console.log("DEBUG TEST 10 SECOND RUN", JSON.stringify(res));
    expect(res.download?.appliedCount).toBe(2);`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
