import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

content = content.replace(/input-standard/g, 'cg-master-input');

// And let's fix card-standard if it still exists
content = content.replace(/card-standard/g, 'cg-master-card-small');

writeFileSync('src/App.tsx', content);
console.log('done script10');
