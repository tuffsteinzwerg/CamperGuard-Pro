const fs = require('fs');
let appDbTs = fs.readFileSync('src/lib/appDatabase.ts', 'utf8');
appDbTs = appDbTs.replace("export const APP_DB_NAME = 'guard4campers-db';", "export const APP_DB_NAME = 'Guard4CampersDB_V1';");
fs.writeFileSync('src/lib/appDatabase.ts', appDbTs);

let appTsx = fs.readFileSync('src/App.tsx', 'utf8');
appTsx = appTsx.replace("const DB_NAME = 'Guard4CampersDB_V1';\n", "");
fs.writeFileSync('src/App.tsx', appTsx);
