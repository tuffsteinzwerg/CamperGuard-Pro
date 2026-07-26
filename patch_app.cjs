const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("import { uploadState, checkForRemoteUpdate } from './lib/syncService';\n", "");
code = code.replace("import { getInitialAuthState } from './lib/googleAuth';\n", "");

const uploadStr = `          // Parallel auf Google Drive hochladen (wenn eingeloggt)
          uploadState(state).catch(err => console.warn('Drive sync:', err));`;

code = code.replace(uploadStr, "");

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx");
