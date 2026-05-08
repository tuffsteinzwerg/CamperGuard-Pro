import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  /<div className="bg-\[var\(--accent\)\] p-3 rounded-lg flex justify-between items-center text-black shadow-lg sticky top-.*? z-20">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g,
  `<div className="cg-master-inset p-3 flex justify-between items-center sticky top-[-10px] z-20">
          <div className="text-center">
              <div className="cg-master-label">Jahres-KM</div>
              <div className="cg-master-value !text-[18px] text-[var(--accent)]" style={{ textShadow: '0 0 10px rgba(var(--accent-rgb), 0.5)' }}>{formatNumber(yearTotals.km, 0)}</div>
          </div>
          <div className="text-center">
              <div className="cg-master-label">Gesamtkosten</div>
              <div className="cg-master-value !text-[18px] text-[var(--status-danger)]" style={{ textShadow: '0 0 10px rgba(var(--status-danger-rgb), 0.5)' }}>{formatNumber(yearTotals.expense, 2)} €</div>
          </div>
          <div className="text-center">
              <div className="cg-master-label">Verbrauch</div>
              <div className="cg-master-value !text-[18px] text-[var(--accent)]" style={{ textShadow: '0 0 10px rgba(var(--accent-rgb), 0.5)' }}>{formatNumber(yearTotals.l100km, 1)} L</div>
          </div>
      </div>`
);

writeFileSync('src/App.tsx', content);
console.log('done script12');
