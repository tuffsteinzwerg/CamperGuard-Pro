const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const errs = code.split('\n').map((l, i) => i + ': ' + l).slice(980, 1020);
console.log(errs.join('\n'));
