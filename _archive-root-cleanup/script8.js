import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

// fix spot category style
content = content.replace(
  /<span className="typo-label" style={{ color: 'var\(--accent\)' }}>{spot.category}<\/span>/g,
  '<span className="typo-label text-[var(--accent)]">{spot.category}</span>'
);

// fix geo link
content = content.replace(
  /<a href={\`geo:\${spot.lat},\${spot.lng}\`} className="typo-tiny text-\[var\(--accent\)\] hover:text-white transition-colors mt-2 flex items-center gap-1 uppercase font-bold">/g,
  '<a href={`geo:${spot.lat},${spot.lng}`} className="cg-master-button !py-1 !px-2 mt-2 inline-flex items-center gap-1 !typo-tiny">'
);

writeFileSync('src/App.tsx', content);
console.log('done script8');
