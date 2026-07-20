const fs = require('fs');
let file2 = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');
file2 = file2.replace(
  `const res = await provider['backend'].downloadChanges(req.vehicleId, req.cursor, req.limit);`,
  `const res = await (provider['backend'] as any).downloadChanges(req.vehicleId, req.cursor, req.limit);`
);
fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', file2);
