import { readFileSync, writeFileSync } from 'fs';
const content = readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const results = [];
lines.forEach((line, i) => {
  if (line.includes('input-standard')) {
    results.push(`Line ${i + 1}: ` + line.trim());
  }
});
writeFileSync('input-standard-lines.txt', results.join('\n'));
