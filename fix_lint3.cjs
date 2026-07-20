const fs = require('fs');
let sStr = fs.readFileSync('src/views/logbuch/LogbuchSpotList.tsx', 'utf8');
sStr = sStr.replace("setSpotForm: (f: FuelEntry) => void;", "setSpotForm: (f: any) => void;");
fs.writeFileSync('src/views/logbuch/LogbuchSpotList.tsx', sStr);

let mStr = fs.readFileSync('src/views/logbuch/LogbuchAddModal.tsx', 'utf8');
mStr = mStr.replace("note: tripForm.note,", "");
fs.writeFileSync('src/views/logbuch/LogbuchAddModal.tsx', mStr);
