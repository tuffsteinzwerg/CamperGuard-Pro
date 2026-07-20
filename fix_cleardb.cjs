const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  "indexedDB.deleteDatabase('app_deviceA');\n    indexedDB.deleteDatabase('app_deviceB');",
  "await new Promise((resolve) => { const req = indexedDB.deleteDatabase('app_deviceA'); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });\n    await new Promise((resolve) => { const req = indexedDB.deleteDatabase('app_deviceB'); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });"
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);
