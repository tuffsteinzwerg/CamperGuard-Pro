const fs = require('fs');
let code = fs.readFileSync('src/lib/syncCoordinator.ts', 'utf8');

code = code.replace(
  `      } else if (entry.status === "failed") {
        if (entry.nextRetryAt && entry.nextRetryAt <= nowIso) {
          selectable = true;
        }
      }`,
  `      } else if (entry.status === "failed") {
        if (!entry.nextRetryAt || entry.nextRetryAt <= nowIso) {
          selectable = true;
        }
      }`
);

fs.writeFileSync('src/lib/syncCoordinator.ts', code);
