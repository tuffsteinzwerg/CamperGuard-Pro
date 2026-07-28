const fs = require('fs');

let pagedContent = fs.readFileSync('src/print/printElementViaPaged.ts', 'utf8');
const pagedTarget = `export function printElementViaPaged(innerHtml: string, title: string) {`;
const pagedRepl = `export function printBySelector(selector: string, title: string) {
  const el = document.querySelector(selector);
  if (el) printElementViaPaged(el.outerHTML, title);
}

export function printElementViaPaged(innerHtml: string, title: string) {`;

if (pagedContent.includes(pagedTarget)) {
    fs.writeFileSync('src/print/printElementViaPaged.ts', pagedContent.replace(pagedTarget, pagedRepl), 'utf8');
    console.log('printElementViaPaged.ts patched');
} else {
    console.log('printElementViaPaged.ts target not found');
}

let logbuchViewContent = fs.readFileSync('src/views/LogbuchView.tsx', 'utf8');
const lvTarget1 = `import { LogbuchPrintViews } from '../print/LogbuchPrintViews';`;
const lvRepl1 = `import { LogbuchPrintViews } from '../print/LogbuchPrintViews';
import { printBySelector } from '../print/printElementViaPaged';`;
const lvTarget2 = `<button onClick={() => window.print()} className="cg-master-button !py-1.5 !px-3"><Printer size={14}/></button>`;
const lvRepl2 = `<button onClick={() => printBySelector('.logbuch-print-wrapper', 'Logbuch')} className="cg-master-button !py-1.5 !px-3"><Printer size={14}/></button>`;

if (logbuchViewContent.includes(lvTarget1) && logbuchViewContent.includes(lvTarget2)) {
    logbuchViewContent = logbuchViewContent.replace(lvTarget1, lvRepl1).replace(lvTarget2, lvRepl2);
    fs.writeFileSync('src/views/LogbuchView.tsx', logbuchViewContent, 'utf8');
    console.log('LogbuchView.tsx patched');
} else {
    console.log('LogbuchView.tsx target not found');
}

let logbuchArchiveContent = fs.readFileSync('src/views/logbuch/LogbuchArchiveDetail.tsx', 'utf8');
const laTarget1 = `import type { Archive as ArchiveType, FuelEntry } from '../../types';`;
const laRepl1 = `import type { Archive as ArchiveType, FuelEntry } from '../../types';
import { printBySelector } from '../../print/printElementViaPaged';`;
const laTarget2 = `onClick={() => window.print()}`;
const laRepl2 = `onClick={() => printBySelector('.logbuch-print-wrapper', 'Logbuch')}`;

if (logbuchArchiveContent.includes(laTarget1) && logbuchArchiveContent.includes(laTarget2)) {
    logbuchArchiveContent = logbuchArchiveContent.replace(laTarget1, laRepl1).replace(laTarget2, laRepl2);
    fs.writeFileSync('src/views/logbuch/LogbuchArchiveDetail.tsx', logbuchArchiveContent, 'utf8');
    console.log('LogbuchArchiveDetail.tsx patched');
} else {
    console.log('LogbuchArchiveDetail.tsx target not found');
}

