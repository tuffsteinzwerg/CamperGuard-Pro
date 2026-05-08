import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(/bg-\[#444\]/g, 'bg-[var(--bg-input)]');
content = content.replace(/border-\[#444\]/g, 'border-[var(--border)]');
content = content.replace(/border-\[#333\]/g, 'border-[var(--border)]');

fs.writeFileSync('src/App.tsx', content);
