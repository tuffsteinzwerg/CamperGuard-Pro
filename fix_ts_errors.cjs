const fs = require('fs');
let file1 = fs.readFileSync('src/lib/__tests__/syncCoordinator.test.ts', 'utf8');
file1 = file1.replace(
  `runSerializedAppWrite: (task) => actualRun(task)`,
  `runSerializedAppWrite: <T>(task: any) => actualRun(task) as Promise<T>`
);
fs.writeFileSync('src/lib/__tests__/syncCoordinator.test.ts', file1);

let file2 = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');
file2 = file2.replace(
  `runSerializedAppWrite: (task) => actualRun(task)`,
  `runSerializedAppWrite: <T>(task: any) => actualRun(task) as Promise<T>`
);
file2 = file2.replace(
  `return provider['backend'].downloadChanges(req.vehicleId, req.cursor, req.limit);`,
  `return (provider['backend'] as any).downloadChanges(req.vehicleId, req.cursor, req.limit);`
);
fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', file2);
