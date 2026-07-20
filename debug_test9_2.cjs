const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');
code = code.replace("it.only('9", "it('9");
fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', code);
