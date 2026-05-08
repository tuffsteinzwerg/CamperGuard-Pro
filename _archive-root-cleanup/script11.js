import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

content = content.replace(/text-\[#888\]/g, 'cg-master-muted');

writeFileSync('src/App.tsx', content);
console.log('done script11');
