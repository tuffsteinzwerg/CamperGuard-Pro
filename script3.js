import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  'className="bg-[var(--accent)] text-black px-3 py-1.5 rounded typo-label flex items-center gap-1.5 animate-pulse border border-[var(--accent-dark)] uppercase tracking-widest shadow-lg shadow-[var(--accent)]/20"',
  'className="cg-master-button animate-pulse flex items-center gap-1.5"'
);

// Map pin log button maybe?
content = content.replace(
  'className="flex-1 py-3 px-3 rounded typo-label transition-all ${logType === t ? \'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--accent)]/50\' : \'text-white hover:text-[var(--accent)] border border-transparent\'}"',
  'className="flex-1 py-3 px-3 rounded transition-all ${logType === t ? \'cg-master-inset cg-master-control-active\' : \'cg-master-button\'}"'
);

writeFileSync('src/App.tsx', content);
console.log('done sos replacement');
