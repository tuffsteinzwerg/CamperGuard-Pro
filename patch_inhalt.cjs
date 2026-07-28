const fs = require('fs');
let content = fs.readFileSync('src/views/InhaltView.tsx', 'utf8');

const targetImport = "import { printVorraetePaged } from '../print/printVorraetePaged';";
const replacementImport = "import { renderToStaticMarkup } from 'react-dom/server';\nimport { printElementViaPaged } from '../print/printElementViaPaged';";

const targetCode = `    if (mode === 'consumables') {
      printVorraetePaged(state);
      return;
    }`;
const replacementCode = `    if (mode === 'consumables') {
      const html = renderToStaticMarkup(<InhaltPrintView state={state} printMode="consumables" />);
      printElementViaPaged(html, 'Vorräte');
      return;
    }`;

let success = true;

if (content.includes(targetImport)) {
    content = content.replace(targetImport, replacementImport);
} else {
    console.log("targetImport not found");
    success = false;
}

if (content.includes(targetCode)) {
    content = content.replace(targetCode, replacementCode);
} else {
    console.log("targetCode not found");
    success = false;
}

if (success) {
    fs.writeFileSync('src/views/InhaltView.tsx', content, 'utf8');
    console.log("Success");
}
