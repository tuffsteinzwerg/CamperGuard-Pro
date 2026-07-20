const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');
code = code.replace("it('10.", "it.only('10.");
fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', code);
