import fs from 'fs';
const p1 = fs.readFileSync('src/AppNew1.tsx', 'utf8');
const p2 = fs.readFileSync('src/AppNew2.tsx', 'utf8');
const p3 = fs.readFileSync('src/AppNew3.tsx', 'utf8');
const p4 = fs.readFileSync('src/AppNew4.tsx', 'utf8');
fs.writeFileSync('src/App.tsx', p1 + p2 + p3 + p4);
console.log("Assembled App.tsx");
