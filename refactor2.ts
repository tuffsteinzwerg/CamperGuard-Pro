import * as fs from 'fs';

const statusViewPath = 'src/views/StatusView.tsx';
let content = fs.readFileSync(statusViewPath, 'utf8');

// 1. Add WeightGauge import
content = content.replace(
  `import { SosHub } from './status/SosHub';`,
  `import { SosHub } from './status/SosHub';\nimport { WeightGauge } from './status/WeightGauge';`
);

// 2. Remove `Scale` from lucide-react import
content = content.replace(
  `import { AlertTriangle, Plus, Check, Scale, CheckCircle, ChevronRight, Droplet, Fuel, Settings, ShieldCheck, Flame } from 'lucide-react';`,
  `import { AlertTriangle, Plus, Check, CheckCircle, ChevronRight, Droplet, Fuel, Settings, ShieldCheck, Flame } from 'lucide-react';`
);

// 3. Fix Warning logic for overLbs
content = content.replace(
  `const overLbs = remainingWeight < 0 ? Math.abs(remainingWeight) : 0;\n  const warnings: { type: 'danger' | 'warn'; text: string; action?: 'pharmacy' }[] = [];\n  if (overLbs > 0) {\n      warnings.push({ type: 'danger', text: \`Fahrzeug überladen! \${formatNumber(overLbs, 0)} kg über ZGG\` });\n  }`,
  `const warnings: { type: 'danger' | 'warn'; text: string; action?: 'pharmacy' }[] = [];\n  if (remainingWeight < 0) {\n      warnings.push({ type: 'danger', text: \`Fahrzeug überladen! \${formatNumber(Math.abs(remainingWeight), 0)} kg über ZGG\` });\n  }`
);

// 4. Replace JSX block
const startMarker = '{/* Element 3: Gewichts-Hero-Anzeige */}';
const targetStart = content.indexOf(startMarker);
if (targetStart === -1) {
    console.error("Start marker not found.");
    process.exit(1);
}

const endMarker = '{/* Element 2: Warnbereich */}';
const targetEnd = content.indexOf(endMarker, targetStart);
if (targetEnd === -1) {
    console.error("End marker not found.");
    process.exit(1);
}

const beforeJSX = content.substring(0, targetStart);
const afterJSX = content.substring(targetEnd);

const replacement = `<WeightGauge 
        totalWeight={totalWeight}
        remainingWeight={remainingWeight}
        state={state}
        setState={setState}
        waterWeightImpact={waterWeightImpact}
        wasteWaterWeight={wasteWaterWeight}
        dieselWeight={dieselWeight}
        inventoryWeight={inventoryWeight}
      />\n\n      `;

content = beforeJSX + replacement + afterJSX;

// Also I should check if there are trailing whitespaces on newlines but it should be fine.

fs.writeFileSync(statusViewPath, content);
console.log('Successfully refactored StatusView.tsx');
