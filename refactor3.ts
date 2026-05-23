import * as fs from 'fs';

const statusViewPath = 'src/views/StatusView.tsx';
const checklistPath = 'src/views/status/DepartureChecklist.tsx';

let content = fs.readFileSync(statusViewPath, 'utf8');

// 1. Add DepartureChecklist import
content = content.replace(
  `import { WeightGauge } from './status/WeightGauge';`,
  `import { WeightGauge } from './status/WeightGauge';\nimport { DepartureChecklist } from './status/DepartureChecklist';`
);

// 2. Remove states
content = content.replace(/  const \[isChecklistOpen, setIsChecklistOpen\] = useState\(false\);\n/, '');
content = content.replace(/  const \[newChecklistItem, setNewChecklistItem\] = useState\(""\);\n/, '');
content = content.replace(/  const \[editingChecklistItemId, setEditingChecklistItemId\] = useState<string \| null>\(null\);\n/, '');
content = content.replace(/  const \[editingChecklistText, setEditingChecklistText\] = useState\(""\);\n/, '');

// Find block
const startMarker = '{/* Element 7: Abfahrt-Checkliste */}';
const targetStart = content.indexOf(startMarker);
if (targetStart === -1) {
    console.error("Start marker not found.");
    process.exit(1);
}

// Find end. We want to stop right before the end of the block.
// It ends with a div and then <SosHub
const remainder = content.substring(targetStart);
// Let's find the position of <SosHub
const endIdx = remainder.indexOf('<SosHub');
if (endIdx === -1) {
    console.error("End marker not found.");
    process.exit(1);
}

const blockJSX = remainder.substring(0, endIdx).trimEnd();
// Because the block has some closing divs, let's extract exactly what's needed.

const checklistContent = `import React, { useState } from 'react';
import type { AppState } from '../../types';
import { Plus, Check, Edit2, Trash2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DepartureChecklistProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function DepartureChecklist({ state, setState }: DepartureChecklistProps) {
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");

  return (
    ${blockJSX}
  );
}
`;

fs.writeFileSync(checklistPath, checklistContent);

const beforeJSX = content.substring(0, targetStart);
const afterJSX = content.substring(targetStart + endIdx);

content = beforeJSX + '  <DepartureChecklist state={state} setState={setState} />\n      ' + afterJSX;

// Also icons cleanup
content = content.replace(
  `import { AlertTriangle, Plus, Check, CheckCircle, ChevronRight, Droplet, Fuel, Settings, ShieldCheck, Flame } from 'lucide-react';`,
  `import { AlertTriangle, CheckCircle, Droplet, Fuel, Settings, ShieldCheck, Flame } from 'lucide-react';`
);

fs.writeFileSync(statusViewPath, content);
console.log('Successfully refactored StatusView.tsx');
