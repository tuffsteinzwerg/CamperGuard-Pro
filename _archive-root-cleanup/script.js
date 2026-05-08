import { readFileSync, writeFileSync } from 'fs';
const content = readFileSync('src/App.tsx', 'utf-8');
const newContent = content.replace(/btn-primary/g, 'cg-master-button').replace(/btn-secondary/g, 'cg-master-button');
writeFileSync('src/App.tsx', newContent);
console.log('done');
