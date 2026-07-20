const fs = require('fs');
let code = fs.readFileSync('src/lib/setupLeafletIcons.ts', 'utf8');
code = code.replace("import iconRetinaUrl", "// @ts-ignore\nimport iconRetinaUrl");
code = code.replace("import iconUrl", "// @ts-ignore\nimport iconUrl");
code = code.replace("import shadowUrl", "// @ts-ignore\nimport shadowUrl");
fs.writeFileSync('src/lib/setupLeafletIcons.ts', code);
