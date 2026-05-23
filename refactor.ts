import * as fs from 'fs';

const statusViewPath = 'src/views/StatusView.tsx';
const sosHubPath = 'src/views/status/SosHub.tsx';

let content = fs.readFileSync(statusViewPath, 'utf8');
const lines = content.split('\n');

// Find the SOS Hub section
const startIdx = lines.findIndex(l => l.includes('{showSos && ('));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('</AnimatePresence>'));

const sosHubJSX = lines.slice(startIdx - 1, endIdx + 1).join('\n'); // <AnimatePresence> is previous line

const sosHubContent = `import React, { useState } from 'react';
import type { AppState } from '../../types';
import { ShieldPlus, Phone, Edit2, Trash2, MapPin, AlertTriangle, Plus, Check, Pill, Droplet, ShieldCheck, ChevronDown, User, HeartPulse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatNumber, formatWeight, normalizeGearName } from '../../lib/formatters';

interface SosHubProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  showSos: boolean;
  setShowSos: (v: boolean) => void;
  sosTab: 'hilfe' | 'id' | 'inhalt';
  setSosTab: (t: 'hilfe' | 'id' | 'inhalt') => void;
  gpsCoords: { lat: number; lng: number } | null;
  gpsAlt: number | null;
  gpsStatus: 'offline' | 'loading' | 'active';
}

export function SosHub({ state, setState, showSos, setShowSos, sosTab, setSosTab, gpsCoords, gpsAlt, gpsStatus }: SosHubProps) {
  const [editingPharmacyId, setEditingPharmacyId] = useState<string | null>(null);
  const [editingGearId, setEditingGearId] = useState<string | null>(null);
  const [deletingGearItem, setDeletingGearItem] = useState<any>(null);
  const [isEditingId, setIsEditingId] = useState(false);

  const updateSos = (field: string, val: any) => setState({...state, sos: {...state.sos, [field]: val}});

  return (
${sosHubJSX}
  );
}
`;

fs.mkdirSync('src/views/status', { recursive: true });
fs.writeFileSync(sosHubPath, sosHubContent);

// Modify StatusView
// 3a) Update import
content = content.replace(
  `import { formatNumber, formatWeight, normalizeGearName } from '../lib/formatters';`,
  `import { formatNumber, formatWeight, normalizeGearName } from '../lib/formatters';\nimport { SosHub } from './status/SosHub';`
);

// 3b) Remove state variables
content = content.replace(/  const \[editingPharmacyId.*?\n/s, '');
content = content.replace(/  const \[editingGearId, setEditingGearId\].*?\n/s, '');
content = content.replace(/  const \[deletingGearItem, setDeletingGearItem\].*?\n/s, '');
content = content.replace(/  const \[isEditingId, setIsEditingId\].*?\n/s, '');

// 3c) Remove updateSos globally and replace the local usage at line 255
content = content.replace(/  const updateSos = \(field: string, val: any\) => setState\(\{...state, sos: \{...state.sos, \[field\]: val\}\}\);\n/g, '');
content = content.replace(
  `onClick={() => updateSos('gpsEnabled', state.sos.gpsEnabled === false ? true : false)}`,
  `onClick={() => setState({...state, sos: {...state.sos, gpsEnabled: state.sos.gpsEnabled === false ? true : false}})}`
);

// 3e) Update icons
content = content.replace(
  `import { ShieldPlus, Phone, Edit2, Trash2, MapPin, AlertTriangle, Plus, Check, Pill, Scale, CheckCircle, ChevronRight, Droplet, Fuel, Settings, ShieldCheck, Flame, ChevronDown, User, HeartPulse } from 'lucide-react';`,
  `import { AlertTriangle, Plus, Check, Scale, CheckCircle, ChevronRight, Droplet, Fuel, Settings, ShieldCheck, Flame } from 'lucide-react';`
);

// 3d) Replace SOS Hub with <SosHub />
const statusViewLines = content.split('\n');
const sStartIdx = statusViewLines.findIndex(l => l.includes('{showSos && ('));
const sEndIdx = statusViewLines.findIndex((l, i) => i > sStartIdx && l.includes('</AnimatePresence>'));

const newStatusViewLines = [
  ...statusViewLines.slice(0, sStartIdx - 1),
  `      <SosHub
        state={state}
        setState={setState}
        showSos={showSos}
        setShowSos={setShowSos}
        sosTab={sosTab}
        setSosTab={setSosTab}
        gpsCoords={gpsCoords}
        gpsAlt={gpsAlt}
        gpsStatus={gpsStatus}
      />`,
  ...statusViewLines.slice(sEndIdx + 1)
];

fs.writeFileSync(statusViewPath, newStatusViewLines.join('\n'));

console.log('Refactoring complete');
