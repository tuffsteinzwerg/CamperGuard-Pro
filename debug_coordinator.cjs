const fs = require('fs');
let code = fs.readFileSync('src/lib/syncCoordinator.ts', 'utf8');

code = code.replace(
  `const page = await this.provider.downloadChanges(request);`,
  `const page = await this.provider.downloadChanges(request);\n        console.log("DOWNLOAD PAGE", JSON.stringify(page, null, 2));`
);

fs.writeFileSync('src/lib/syncCoordinator.ts', code);
