import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  /className="cg-master-button flex-1 py-3" style={{ background: 'var\(--status-danger\)', borderColor: 'var\(--status-danger\)' }}/g,
  'className="cg-master-button-danger flex-1 py-3"'
);

// We should also find all other buttons with py-3 ?
// Let's check for any remaining button with var(--accent) backgrounds
content = content.replace(
  /style={{ background: 'var\(--accent\)', borderColor: 'var\(--accent\)', color: 'black' }}/g,
  ''
);

content = content.replace(
  /className="cg-master-button flex-1 py-3"/g,
  'className="cg-master-button flex-1 !p-3"' // ensure the padding applies
);

writeFileSync('src/App.tsx', content);
console.log('done script5 replacement');
