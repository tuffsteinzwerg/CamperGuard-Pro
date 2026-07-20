const fs = require('fs');

let appStr = fs.readFileSync('src/App.tsx', 'utf8');
appStr = appStr.replace("import type { AppState, SpotEntry", "import type { AppState, SpotEntry, Archive");
appStr = appStr.replace("<ErrorBoundary>", '<ErrorBoundary key="main-error-boundary">');
fs.writeFileSync('src/App.tsx', appStr);

let ebStr = fs.readFileSync('src/components/ErrorBoundary.tsx', 'utf8');
ebStr = ebStr.replace("interface ErrorBoundaryProps {\n  children: React.ReactNode;\n}", "interface ErrorBoundaryProps {\n  children: React.ReactNode;\n  key?: React.Key;\n}");
ebStr = ebStr.replace("export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {\n  constructor(props: ErrorBoundaryProps) {", "export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {\n  state: ErrorBoundaryState = { hasError: false, error: null };\n  constructor(props: ErrorBoundaryProps) {");
fs.writeFileSync('src/components/ErrorBoundary.tsx', ebStr);

let pStr = fs.readFileSync('src/print/InhaltPrintView.tsx', 'utf8');
pStr = pStr.replace("const loc = (p.locations && p.locations.trim()) ? p.locations.trim() : 'Ohne Lagerort';", "const loc = (p.location && p.location.trim()) ? p.location.trim() : 'Ohne Lagerort';");
fs.writeFileSync('src/print/InhaltPrintView.tsx', pStr);

let prStr = fs.readFileSync('src/views/ProfilView.tsx', 'utf8');
prStr = prStr.replace("const liters = (level / 100) * capacity;", "const liters = (Number(level) / 100) * Number(capacity);");
fs.writeFileSync('src/views/ProfilView.tsx', prStr);

let mStr = fs.readFileSync('src/views/logbuch/LogbuchAddModal.tsx', 'utf8');
mStr = mStr.replace("note: '',", ""); 
fs.writeFileSync('src/views/logbuch/LogbuchAddModal.tsx', mStr);

let sStr = fs.readFileSync('src/views/logbuch/LogbuchSpotList.tsx', 'utf8');
sStr = sStr.replace("name: '',", "");
fs.writeFileSync('src/views/logbuch/LogbuchSpotList.tsx', sStr);
