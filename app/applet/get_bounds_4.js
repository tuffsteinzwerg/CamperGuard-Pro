import fs from 'fs';

const file = fs.readFileSync('src/views/LogbuchView.tsx', 'utf8');

const tTank = "      {logType === 'tank' && (\n          <div className=\"space-y-3\">\n            {currentFuelLog.map((entry:any)";
const idxTankStart = file.indexOf(tTank);
if (idxTankStart > 0) {
    const endStr = "          </div>\n      )}";
    const idxTankEnd = file.indexOf(endStr, idxTankStart);
    console.log("Tank bounds:", idxTankStart, idxTankEnd);
}

const tFahrt = "      {logType === 'fahrt' && (\n          <div className=\"space-y-4\">\n              <div className=\"cg-master-card-small !p-2 !mb-0 flex bg-[var(--bg-app)]\">";
const idxFahrtStart = file.indexOf(tFahrt);
const tSpots = "      {logType === 'spots' && (\n          <div className=\"space-y-3\">\n              <button";
const idxSpotsStart = file.indexOf(tSpots);

if (idxFahrtStart > 0 && idxSpotsStart > 0) {
    let fahrtText = file.substring(idxFahrtStart, idxSpotsStart);
    let fahrtEnd = fahrtText.lastIndexOf("          </div>\n      )}");
    console.log("Fahrt bounds:", idxFahrtStart, idxFahrtStart + fahrtEnd);
}

if (idxSpotsStart > 0) {
    const endStrSpots = "          </div>\n      )}";
    let spotsEnd = file.indexOf(endStrSpots, idxSpotsStart);
    console.log("Spots bounds:", idxSpotsStart, spotsEnd);
}
