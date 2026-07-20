const fs = require('fs');

// 1. App.tsx
let appStr = fs.readFileSync('src/App.tsx', 'utf8');
appStr = appStr.replace(/import type \{ AppState /, "import type { AppState, Archive ");
appStr = appStr.replace(/<ErrorBoundary>/g, "<ErrorBoundary key=\"error-boundary\">");
fs.writeFileSync('src/App.tsx', appStr);

// 2. ErrorBoundary.tsx
let ebStr = fs.readFileSync('src/components/ErrorBoundary.tsx', 'utf8');
if (!ebStr.includes('state = {')) {
  ebStr = ebStr.replace('export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {',
    'export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {\n  state: ErrorBoundaryState = { hasError: false, error: null };\n');
}
fs.writeFileSync('src/components/ErrorBoundary.tsx', ebStr);

// 3. InhaltPrintView.tsx
let pStr = fs.readFileSync('src/print/InhaltPrintView.tsx', 'utf8');
pStr = pStr.replace(/p\.locations\.trim/g, "p.location.trim");
pStr = pStr.replace(/p\.locations \?/g, "p.location ?");
pStr = pStr.replace(/p\.locations && p\.locations\.trim/g, "p.location && p.location.trim");
fs.writeFileSync('src/print/InhaltPrintView.tsx', pStr);

// 4. InhaltView.tsx
let iStr = fs.readFileSync('src/views/InhaltView.tsx', 'utf8');
iStr = iStr.replace("import { useState, useMemo } from 'react';", "import React, { useState, useMemo } from 'react';");
fs.writeFileSync('src/views/InhaltView.tsx', iStr);

// 5. ProfilView.tsx
let prStr = fs.readFileSync('src/views/ProfilView.tsx', 'utf8');
prStr = prStr.replace("const liters = (level / 100) * capacity;", "const liters = (level / 100) * Number(capacity);");
prStr = prStr.replace("f: FAQEntry, i: number", "f: any, i: number");
fs.writeFileSync('src/views/ProfilView.tsx', prStr);

// 6. LogbuchAddModal.tsx
let mStr = fs.readFileSync('src/views/logbuch/LogbuchAddModal.tsx', 'utf8');
mStr = mStr.replace("note: '',", ""); // Remove note from TripEntry payload if not allowed
fs.writeFileSync('src/views/logbuch/LogbuchAddModal.tsx', mStr);

// 7. LogbuchSpotList.tsx
let sStr = fs.readFileSync('src/views/logbuch/LogbuchSpotList.tsx', 'utf8');
sStr = sStr.replace("name: '',", ""); // Remove name from FuelEntry if not allowed
fs.writeFileSync('src/views/logbuch/LogbuchSpotList.tsx', sStr);

