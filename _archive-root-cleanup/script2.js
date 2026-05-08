import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

// Replace Settings Button
content = content.replace(
  'className="p-2 rounded bg-black/40 border border-[var(--border)] active:scale-95 transition-all text-white hover:text-[var(--accent)] flex-shrink-0"',
  'className="cg-master-button !p-2 !rounded flex-shrink-0"'
);

// Replace MapPin button (GPS fetch)
content = content.replace(
  'className="p-3 bg-blue-500 text-white rounded border border-blue-400 font-black"',
  'className="cg-master-inset cg-master-control w-12 flex items-center justify-center rounded"'
);

// Replace Demo Buttons
content = content.replace(
  'className="w-full bg-blue-500 text-white py-4 rounded typo-label shadow-lg"',
  'className="cg-master-button w-full"'
);
content = content.replace(
  'className="w-full bg-red-600 text-white py-4 rounded typo-label shadow-lg"',
  'className="cg-master-button-danger w-full"'
);

writeFileSync('src/App.tsx', content);
console.log('done inline replacements');
