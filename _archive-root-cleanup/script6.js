import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  /<button onClick=\{\(\) => hc\('profile\.isTwinTires', !state\.profile\.isTwinTires\)\} className="typo-label transition-colors" style=\{\{ color: state\.profile\.isTwinTires \? 'var\(--accent\)' : 'color-mix\\(in srgb, var\(--accent\) 50%, transparent\\)' \}\}>\+ ZWILLING<\/button>/g,
  '<button onClick={() => hc(\'profile.isTwinTires\', !state.profile.isTwinTires)} className={`cg-master-inset h-6 px-2 rounded flex items-center justify-center gap-1 text-[10px] border border-transparent ${state.profile.isTwinTires ? \'_cg-master-control-active !border-[var(--accent)] text-[var(--accent)]\' : \'cg-master-control\'}`}><span className={state.profile.isTwinTires ? \'bg-[var(--accent)] w-1.5 h-1.5 rounded-full\' : \'_hidden\'}></span> ZWILLING</button>'
);

// fix inline classes manually
content = content.replace(/_cg-master-control-active/g, 'bg-black/40 shadow-inner');
content = content.replace(/_hidden/g, 'hidden');

writeFileSync('src/App.tsx', content);
console.log('done script6');
