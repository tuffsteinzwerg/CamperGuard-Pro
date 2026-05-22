const fs = require('fs');

const file = fs.readFileSync('src/views/LogbuchView.tsx', 'utf8');

const startStr = '      {logType === \'archiv\' && (\n          <div className="space-y-4">';
const endStr = '          </div>\n      )}';

const startIdx = file.indexOf(startStr);
const endIdx = file.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const extracted = file.substring(startIdx + startStr.length - 12 - 27, endIdx + 16);
    console.log("Found bounds!");
} else {
    console.log("Could not find bounds", startIdx, endIdx);
}
