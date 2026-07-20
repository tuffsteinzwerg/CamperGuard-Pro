const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');
code = code.replace(
  "let resA = await coordA.runSync();",
  "console.log('outboxA:', await getOutbox(), 'syncStateA:', await (await dbModule.openAppDatabase()).get('syncState', 'provA'));\n    let resA = await coordA.runSync();\n    console.log('resA:', resA);"
);
fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
