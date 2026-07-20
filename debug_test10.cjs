const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', 'utf8');

code = code.replace(
  `  it('10. Erfolgreiche Remote-Events verändern den AppState genau einmal.', async () => {`,
  `  it.only('10. Erfolgreiche Remote-Events verändern den AppState genau einmal.', async () => {`
);
fs.writeFileSync('src/lib/__tests__/syncCoordinatorDownload.test.ts', code);
