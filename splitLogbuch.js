const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const logbuchStartStr = '// --- TAB: LOGBUCH ---';
const logbuchStartIndex = appCode.indexOf(logbuchStartStr);

const reiseStartStr = '// --- TAB: REISE ---';
const reiseStartIndex = appCode.indexOf(reiseStartStr);

if (logbuchStartIndex === -1 || reiseStartIndex === -1) {
    console.error('Could not find start/end markers.');
    process.exit(1);
}

// Extract the content that needs to be moved
const logbuchContent = appCode.substring(logbuchStartIndex, reiseStartIndex);

// Remove the content from App.tsx
const newAppCode = appCode.substring(0, logbuchStartIndex) + appCode.substring(reiseStartIndex);

fs.writeFileSync('src/App.tsx', newAppCode);

// Write to LogbuchView.tsx
fs.writeFileSync('src/views/LogbuchView.tsx.part', logbuchContent);
