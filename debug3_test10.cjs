const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  `    const res = await devA.coord.runSync();
    console.log("DEBUG TEST 10 SECOND RUN", JSON.stringify(res));`,
  `    console.log("STORE EVENTS BEFORE SECOND RUN", JSON.stringify(devA.coord['provider']['backend'].getStore('v1')));
    const res = await devA.coord.runSync();
    console.log("DEBUG TEST 10 SECOND RUN", JSON.stringify(res));`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
