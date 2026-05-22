const fs = require('fs');

let f;

// 1. StatusView.tsx
f = 'src/views/StatusView.tsx';
let c = fs.readFileSync(f, 'utf8');
if (!c.includes("import type { AppState }")) {
    c = "import type { AppState } from '../types';\n" + c;
}
c = c.replace(
    /export function StatusView\(\{ state, setState, orientation, showSos, setShowSos, sosTab, setSosTab \}: any\) \{/g,
    `interface StatusViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  orientation: { pitch: number; roll: number; heading: number };
  showSos: boolean;
  setShowSos: (v: boolean) => void;
  sosTab: 'hilfe' | 'id' | 'inhalt';
  setSosTab: (t: 'hilfe' | 'id' | 'inhalt') => void;
}

export function StatusView({ state, setState, orientation, showSos, setShowSos, sosTab, setSosTab }: StatusViewProps) {`
);
fs.writeFileSync(f, c);

// 2. InhaltView.tsx
f = 'src/views/InhaltView.tsx';
c = fs.readFileSync(f, 'utf8');
if (!c.includes("import type { AppState }")) {
    c = "import type { AppState } from '../types';\n" + c;
}
c = c.replace(
    /export function InhaltView\(\{ state, setState \}: any\) \{/g,
    `interface InhaltViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function InhaltView({ state, setState }: InhaltViewProps) {`
);
fs.writeFileSync(f, c);

// 3. ProfilView.tsx
f = 'src/views/ProfilView.tsx';
c = fs.readFileSync(f, 'utf8');
if (!c.includes("import type { AppState }")) {
    c = "import type { AppState } from '../types';\n" + c;
}
c = c.replace(
    /export function ProfilView\(\{ state, setState \}: any\) \{/g,
    `interface ProfilViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function ProfilView({ state, setState }: ProfilViewProps) {`
);
fs.writeFileSync(f, c);

// 4. ReiseView.tsx
f = 'src/views/ReiseView.tsx';
c = fs.readFileSync(f, 'utf8');
if (!c.includes("import type { AppState }")) {
    c = "import type { AppState } from '../types';\n" + c;
}
c = c.replace(
    /export function ReiseView\(\{ state, setState, orientation, orientationPermission, requestOrientationPermission \}: any\) \{/g,
    `interface ReiseViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  orientation: { pitch: number; roll: number; heading: number };
  orientationPermission: 'granted' | 'denied' | 'prompt' | 'unknown';
  requestOrientationPermission: () => Promise<void>;
}

export function ReiseView({ state, setState, orientation, orientationPermission, requestOrientationPermission }: ReiseViewProps) {`
);
fs.writeFileSync(f, c);

// 5. LogbuchView.tsx
f = 'src/views/LogbuchView.tsx';
c = fs.readFileSync(f, 'utf8');
if (!c.includes("import type { AppState }")) {
    c = c.replace("import React from 'react';", "import React from 'react';\nimport type { AppState } from '../types';");
}
c = c.replace(
    /export function LogbuchView\(\{ state, setState \}: any\) \{/g,
    `interface LogbuchViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function LogbuchView({ state, setState }: LogbuchViewProps) {`
);
fs.writeFileSync(f, c);
