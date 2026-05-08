import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

content = content.replace(/text-\[#ff3b30\] animate-pulse/g, 'text-[var(--status-danger)] animate-pulse');
content = content.replace(/drop-shadow-\[0_0_8px_rgba\(255,59,48,0\.5\)\]/g, 'drop-[var(--status-danger)]'); // wait drop shadow doesn't work easily with css vars in tailwind arbitrary. I'll just remove drop-shadow or make it inline style textShadow.

content = content.replace(
  /<AlertTriangle size={20} className="filter drop-shadow-\[0_0_8px_rgba\(255,59,48,0\.5\)\]" \/>/g,
  '<AlertTriangle size={20} style={{ filter: \'drop-shadow(0 0 8px rgba(var(--status-danger-rgb), 0.5))\' }} />'
);


writeFileSync('src/App.tsx', content);
console.log('done script13');
