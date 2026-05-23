import type { FuelEntry } from '../types.ts';

export function calculateFuelConsumptionSegments(fuelEntries: FuelEntry[]) {
// Sort entries chronologically (oldest first)
const sortedEntries = [...fuelEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

const segments = [];
let lastFullTankKm = null;
let accumulatedLiters = 0;
let hasPartialFills = false;

for (const entry of sortedEntries) {
// We treat entries without vollgetankt as true according to previous rules,
// but the type says boolean. To be safe: entry.vollgetankt !== false
const isFullTank = entry.vollgetankt !== false;

if (lastFullTankKm === null) {
  if (isFullTank) {
    lastFullTankKm = entry.km;
    accumulatedLiters = 0; // Don't count liters of the very first full tank for consumption of the *next* segment
    hasPartialFills = false;
  }
} else {
  accumulatedLiters += entry.liters;
  
  if (isFullTank) {
    const distance = entry.km - lastFullTankKm;
    
    if (distance > 0) {
      const consumption = (accumulatedLiters / distance) * 100;
      segments.push({
        startKm: lastFullTankKm,
        endKm: entry.km,
        totalLiters: accumulatedLiters,
        distance: distance,
        consumption: consumption,
        isApproximate: hasPartialFills
      });
    }
    
    lastFullTankKm = entry.km;
    accumulatedLiters = 0;
    hasPartialFills = false;
  } else {
    hasPartialFills = true;
  }
}

}

return segments;
}

export function calculateAverageFuelConsumptionFromFuelLog(fuelEntries: FuelEntry[]) {
const segments = calculateFuelConsumptionSegments(fuelEntries);

if (segments.length === 0) {
const fullTanksCount = fuelEntries.filter(e => e.vollgetankt !== false).length;
if (fullTanksCount === 1) {
return {
consumption: null,
isApproximate: false,
message: "Erste Volltankung als Startpunkt erfasst"
};
}
return {
consumption: null,
isApproximate: false,
message: "Noch keine Verbrauchsberechnung möglich"
};
}

let sumLiters = 0;
let sumDistance = 0;
let hasApproximate = false;

for (const segment of segments) {
sumLiters += segment.totalLiters;
sumDistance += segment.distance;
if (segment.isApproximate) {
hasApproximate = true;
}
}

const consumption = sumDistance > 0 ? (sumLiters / sumDistance) * 100 : null;

return {
consumption,
isApproximate: hasApproximate,
message: hasApproximate
? "Verbrauch nur ca., da Teilbetankungen enthalten sind"
: "Verbrauch aus Volltankungen berechnet"
};
}

export function calculateFuelLogStats(fuelEntries: FuelEntry[]) {
const sorted = [...fuelEntries].sort((a: FuelEntry, b: FuelEntry) => {
const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
if (timeDiff !== 0) return timeDiff;
return (a.km || 0) - (b.km || 0);
});

const totalLiters = sorted.reduce((acc: number, entry: FuelEntry) => acc + (entry.liters || 0), 0);
const totalCost = sorted.reduce((acc: number, entry: FuelEntry) => {
if (entry.total != null && entry.total !== '') {
return acc + Number(entry.total) / (entry.exchangeRateToEur || 1);
}
return acc + ((entry.liters || 0) * (entry.price || 0)) / (entry.exchangeRateToEur || 1);
}, 0);

const kmValues = sorted.map(e => e.km).filter(km => typeof km === 'number' && !isNaN(km));
let tankKm: number | null = null;
if (kmValues.length >= 2) {
tankKm = Math.max(...kmValues) - Math.min(...kmValues);
}

const avgData = calculateAverageFuelConsumptionFromFuelLog(fuelEntries);

let message = avgData.message;
if (avgData.consumption !== null) {
if (avgData.isApproximate) {
message = "Tankstatistik enthält Teilbetankungen";
} else {
message = "Tankstatistik aus Tankdaten berechnet";
}
}

return {
totalLiters,
totalCost,
tankKm,
averageConsumption: avgData.consumption,
isApproximate: avgData.isApproximate,
message
};
}
