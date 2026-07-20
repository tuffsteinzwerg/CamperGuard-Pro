const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');
code = code.replace("it.only('10", "it('10");

code = code.replace(
  `    await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    await coordinator.runDownload();`,
  `    const r = await provider.uploadEvents({ vehicleId: 'v1', events: [createRemoteEvent('e1')] });
    console.log("UPLOAD RESULT", r);
    const dr = await coordinator.runDownload();
    console.log("DOWNLOAD RESULT", dr);`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', code);
