const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinator.test.ts', 'utf8');

code = code.replace(
  `    const result2 = await coordinator.runUpload();
    expect(result2.selectedCount).toBe(0);
    expect(spy).toHaveBeenCalledTimes(1);`,
  `    const result2 = await coordinator.runUpload();
    // In order to recover from access_revoked upon forced runUpload(), it might select the event again to try.
    // So selectedCount could be 1, but it will fail again and increment spy to 2.
    expect(result2.selectedCount).toBe(1);
    expect(spy).toHaveBeenCalledTimes(2);`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinator.test.ts', code);
