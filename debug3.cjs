const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  "currentDevice = 'deviceA';\n    await coordA.runSync();\n\n    let invA = await getInventory();",
  "currentDevice = 'deviceA';\n    let res3 = await coordA.runSync(); console.log('Test 3 res3:', res3);\n\n    let invA = await getInventory();"
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
