import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replacement logic
content = content.replace(/bg-\[#FF6600\]/g, 'bg-[var(--accent)]');
content = content.replace(/border-\[#FF6600\]/g, 'border-[var(--accent)]');
content = content.replace(/text-\[#FF6600\]/g, 'text-[var(--accent)]');
content = content.replace(/shadow-\[#FF6600\]/g, 'shadow-[var(--accent)]');
content = content.replace(/accent-\[#FF6600\]/g, 'accent-[var(--accent)]');

content = content.replace(/bg-\[#1A1C1E\]/g, 'bg-[var(--bg-app)]');
content = content.replace(/bg-\[#2C2E30\]/g, 'bg-[var(--bg-card)]');
content = content.replace(/border-\[#CC5200\]/g, 'border-[var(--accent-dark)]');
content = content.replace(/bg-\[#111\]/g, 'bg-[var(--bg-input)]');
content = content.replace(/border-\[#3d3d3d\]/g, 'border-[var(--border)]');

content = content.replace(/background: '#111'/g, 'background: \'var(--bg-input)\'');
content = content.replace(/stroke="#FF6600"/g, 'stroke="var(--accent)"');
content = content.replace(/fill="#FF6600"/g, 'fill="var(--accent)"');

// Specific classes substitutions
content = content.replace(/btn-secondary text-\[10px\] px-2 py-1/g, 'btn-secondary typo-label px-2 py-1! normal-case');
content = content.replace(/px-2 py-1 text-\[10px\]/g, 'typo-label px-2 py-1! normal-case');
content = content.replace(/text-\[10px\] text-gray-500 font-bold uppercase/g, 'typo-label');

content = content.replace(/bg-blue-500 text-white py-4 rounded font-black text-\[10px\] uppercase tracking-widest shadow-lg/g, 'bg-blue-500 text-white py-4 rounded typo-label shadow-lg');
content = content.replace(/bg-red-600 text-white py-4 rounded font-black text-\[10px\] uppercase tracking-widest shadow-lg/g, 'bg-red-600 text-white py-4 rounded typo-label shadow-lg');
content = content.replace(/text-\[14px\] font-medium/g, 'typo-body');
content = content.replace(/text-\[12px\] font-black/g, 'typo-label');
content = content.replace(/text-\[11px\]/g, 'text-[12px]'); // For places where typo-label wasn't applied, scale it up slightly to match 12px label or down to 10px tiny
content = content.replace(/text-\[9px\] uppercase font-bold/g, 'typo-tiny');
content = content.replace(/bg-\[#2a68a6\]\/20 text-\[#5c9ce6\] px-3 py-1 rounded text-\[12px\] font-black font-mono border border-\[#2a68a6\]\/40/g, 'bg-[#2a68a6]/20 text-[#5c9ce6] px-3 py-1 rounded typo-label font-mono border border-[#2a68a6]/40');

fs.writeFileSync('src/App.tsx', content);
