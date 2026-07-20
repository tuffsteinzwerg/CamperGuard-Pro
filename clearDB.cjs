const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  "backend = new InMemoryLoopbackBackend();",
  "backend = new InMemoryLoopbackBackend();\n    indexedDB.deleteDatabase('app_deviceA');\n    indexedDB.deleteDatabase('app_deviceB');"
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
