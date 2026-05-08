import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

// Fahrten / Fahrtenbuch tabs
content = content.replace(
  /<div className="flex bg-\[var\(--bg-input\)\] p-1 rounded border border-\[var\(--border\)\]">([\s\S]*?)<\/div>/,
  (match) => {
     if(match.includes('setTripLogMode')) {
         return `<div className="cg-master-inset cg-master-tabs p-1">
      <button onClick={() => setTripLogMode('flex')} className={\`cg-master-tab \${tripLogMode === 'flex' ? 'cg-master-tab-active' : ''}\`}>Fahrten</button>
      <button onClick={() => setTripLogMode('strict')} className={\`cg-master-tab \${tripLogMode === 'strict' ? 'cg-master-tab-active' : ''}\`}>Fahrtenbuch</button>
  </div>`;
     }
     return match;
  }
);

// Main Logbuch tabs (Tanken, Fahrten, POI's, Archiv)
content = content.replace(
  /<div className="flex p-1 bg-\[var\(--bg-input\)\] rounded border border-\[var\(--border\)\] overflow-x-auto hide-scrollbar">([\s\S]*?)<\/div>/,
  `<div className="cg-master-inset cg-master-tabs p-1 overflow-x-auto hide-scrollbar">
      {['tank', 'fahrt', 'spots', 'archiv'].map(t => (
        <button key={t} onClick={() => setLogType(t as any)} className={\`cg-master-tab \${logType === t ? 'cg-master-tab-active' : ''}\`}>{t === 'tank' ? 'Tanken' : t === 'spots' ? "POI's" : t === 'fahrt' ? 'Fahrten' : t}</button>
      ))}
  </div>`
);

// Any other inline styles for buttons
content = content.replace(/className="text-white hover:text-white\/50 transition-colors p-2 font-bold normal-case leading-none"/g, 'className="cg-master-button !p-2 !rounded flex-shrink-0"');


writeFileSync('src/App.tsx', content);
console.log('done script7');
