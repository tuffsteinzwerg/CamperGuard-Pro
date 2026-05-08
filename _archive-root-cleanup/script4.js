import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

// Pharmacy CTA
content = content.replace(
  'className="flex items-center justify-center gap-2 w-full text-center py-4 bg-[var(--bg-input)] hover:bg-[var(--bg-card)] text-white rounded-xl border border-[var(--border)] shadow-md active:scale-95 transition-all mt-4 font-bold tracking-wider uppercase text-xs"',
  'className="cg-master-button w-full mt-4"'
);

// + Ort and + Med. buttons
content = content.replace(
  'className="cg-master-inset cg-master-control h-6 px-2 rounded flex items-center gap-1 text-[10px]"',
  'className="cg-master-button !py-1 !px-2"'
);
content = content.replace(
  'className="cg-master-inset cg-master-control h-6 px-2 rounded flex items-center gap-1 text-[10px]"',
  'className="cg-master-button !py-1 !px-2"'
);

// Other text-white hover:text-accent generic buttons
content = content.replace(/className="text-white hover:text-\[var\(--accent\)\]"/g, 'className="cg-master-button !p-2 !rounded flex-shrink-0"');
content = content.replace(/className="text-white hover:text-\[var\(--accent\)\] transition-colors p-2"/g, 'className="cg-master-button !p-2 !rounded flex-shrink-0"');
content = content.replace(/className="text-white hover:text-red-500"/g, 'className="cg-master-button-danger !p-2 !rounded flex-shrink-0"');

// And text-white/30 stuff
content = content.replace(/className="text-white\/30 hover:text-\[var\(--accent\)\] transition-colors p-2"/g, 'className="cg-master-button !p-2 !rounded flex-shrink-0"');
content = content.replace(/className="text-white\/30 hover:text-red-500 transition-colors p-2"/g, 'className="cg-master-button-danger !p-2 !rounded flex-shrink-0"');
content = content.replace(/className="text-white\/30 hover:text-red-500 transition-colors p-2 -mr-2"/g, 'className="cg-master-button-danger !p-2 !rounded flex-shrink-0 -mr-2"');
content = content.replace(/className="text-white\/30 hover:text-white transition-colors p-1"/g, 'className="cg-master-button !p-1 !rounded flex-shrink-0"');
content = content.replace(/className="text-white\/30 hover:text-red-500 transition-colors p-1 -mr-2"/g, 'className="cg-master-button-danger !p-1 !rounded flex-shrink-0 -mr-2"');
content = content.replace(/className="text-white\/30 hover:text-\[\#5c9ce6\] transition-colors p-1"/g, 'className="cg-master-button !p-1 !rounded flex-shrink-0"');
content = content.replace(/className="text-white\/30 hover:text-\[var\(--accent\)\] transition-colors p-1"/g, 'className="cg-master-button !p-1 !rounded flex-shrink-0"');
content = content.replace(/className="text-white\/30 hover:text-red-500 transition-colors p-1"/g, 'className="cg-master-button-danger !p-1 !rounded flex-shrink-0"');


writeFileSync('src/App.tsx', content);
console.log('done script4 replacement');
