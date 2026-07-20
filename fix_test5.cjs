const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(/const db2 = await dbModule/g, "const db = await dbModule");
code = code.replace(/db2.getAll/g, "db.getAll");
code = code.replace(/db2.close/g, "db.close");

code = code.replace(
  "const db = await dbModule.openAppDatabase(); console.log('deferred in DB:', await db.getAll('deferredEvents')); db.close();\n    let res = await coordA.runDeferredProcessing();",
  "let res = await coordA.runDeferredProcessing();"
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
