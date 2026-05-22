const fs = require('fs');

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
if (idxFahrtStart > 0) {
    let currentEnd = idxFahrtStart;
    for (let i = 0; i < 3; i++) {
        currentEnd = file.indexOf("          </div>\n      )}", currentEnd + 1);
    }
    console.log("Fahrt bounds:", idxFahrtStart, currentEnd);
}

const tSpots = "      {logType === 'spots' && (\n          <div className=\"space-y-3\">\n              <button";
const idxSpotsStart = file.indexOf(tSpots);
if (idxSpotsStart > 0) {
    const endStrSpots = "          </div>\n      )}";
    let spotsEnd = file.indexOf(endStrSpots, idxSpotsStart);
    console.log("Spots bounds:", idxSpotsStart, spotsEnd);
}
