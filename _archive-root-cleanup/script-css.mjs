import fs from 'fs';
let content = fs.readFileSync('src/index.css', 'utf-8');

content = content.replace(/\.brushed-metal-card\s*\{[\s\S]*?!\s*important;\s*\}/g, '');
content = content.replace(/\.metal-input\s*\{[\s\S]*?\}\s*\.metal-input:focus\s*\{[\s\S]*?\}/g, '');

fs.writeFileSync('src/index.css', content);
