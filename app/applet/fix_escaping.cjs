const fs = require('fs');
let content = fs.readFileSync('src/views/logbuch/useLogbuch.ts', 'utf8');

content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
content = content.replace(/\\\\n\\\\n/g, '\\n\\n');

fs.writeFileSync('src/views/logbuch/useLogbuch.ts', content);
