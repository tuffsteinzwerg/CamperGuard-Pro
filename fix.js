const fs = require('fs');
let code = fs.readFileSync('src/views/InhaltView.tsx', 'utf8');
code = code.replace(/\\n/g, '\n');
code = code.replace(/\\"/g, '"');
fs.writeFileSync('src/views/InhaltView.tsx', code);
