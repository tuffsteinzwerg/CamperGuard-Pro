const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const classRegex = /className="([^"]+)"/g;
let match;
const typoCounts = {};
while ((match = classRegex.exec(content)) !== null) {
  const classes = match[1].split(/\s+/);
  for (const c of classes) {
    if (c.startsWith('typo-') || c.startsWith('cg-master-label') || c.startsWith('cg-master-value') || c.startsWith('cg-master-title') || c.startsWith('cg-master-section')) {
      typoCounts[c] = (typoCounts[c] || 0) + 1;
    }
  }
}
const sortedTypo = Object.entries(typoCounts).sort((a,b) => b[1] - a[1]);
console.log("Typo classes:");
console.log(sortedTypo);

const inlineStyleRegex = /style=\{\{([^}]+)\}\}/g;
let styleMatch;
const inlineStyles = [];
while ((styleMatch = inlineStyleRegex.exec(content)) !== null) {
  if (styleMatch[1].match(/font|text|color|line/i)) {
    inlineStyles.push(styleMatch[1]);
  }
}
console.log("Inline styles related to text:");
console.log(inlineStyles);
