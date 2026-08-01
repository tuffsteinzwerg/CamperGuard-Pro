const fs = require('fs');
let content = fs.readFileSync('src/components/BarcodeScanner.tsx', 'utf8');

content = content.replace(
  "import { BrowserMultiFormatReader } from '@zxing/browser';",
  "import { BrowserMultiFormatReader } from '@zxing/browser';\nimport { DecodeHintType, BarcodeFormat } from '@zxing/library';"
);

const readerStr = "    const reader = new BrowserMultiFormatReader();";
const readerRepl = `    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128,
    ]);
    const reader = new BrowserMultiFormatReader(hints);`;

content = content.replace(readerStr, readerRepl);

fs.writeFileSync('src/components/BarcodeScanner.tsx', content, 'utf8');
console.log('Done');
