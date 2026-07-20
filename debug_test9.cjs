const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');
code = code.replace("it('9.", "it.only('9.");
code = code.replace(
  `    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    
    const result = await coordinator.runDownload();`,
  `    const upRes = await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    console.log("TEST 9 UPLOAD", upRes);
    const result = await coordinator.runDownload();
    console.log("TEST 9 DOWNLOAD", result);`
);
fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', code);
