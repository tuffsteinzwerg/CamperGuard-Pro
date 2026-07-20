const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');
code = code.replace(
  "let res = await coordA.runDeferredProcessing();",
  "const db = await dbModule.openAppDatabase(); console.log('deferred in DB:', await db.getAll('deferredEvents')); db.close();\n    let res = await coordA.runDeferredProcessing();"
);
fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
