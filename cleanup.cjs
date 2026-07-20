const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  "console.log('outboxA:', await getOutbox(), 'syncStateA:', await (await dbModule.openAppDatabase()).get('syncState', 'provA'));\n    let resA = await coordA.runSync();\n    console.log('resA:', resA);",
  "let resA = await coordA.runSync();"
);

code = code.replace(
  "console.log('Test 3 outbox before:', await getOutbox());\n    await coordA.runSync();",
  "await coordA.runSync();"
);

code = code.replace(
  "let res3 = await coordA.runSync(); console.log('Test 3 res3:', res3);",
  "await coordA.runSync();"
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
