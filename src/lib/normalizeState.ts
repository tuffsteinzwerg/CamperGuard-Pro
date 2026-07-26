import { INITIAL_STATE } from '../types';
import type { AppState } from '../types';

const ARRAY_FIELDS = [
  'inventory', 'fuelLog', 'tripLog', 'businessTripLog',
  'archives', 'spots', 'faqs', 'checklist', 'maintenance'
] as const;

const LEVEL_FIELDS = ['waterLevel', 'wasteWaterLevel', 'dieselLevel'] as const;

/**
 * Fuellt fehlende Felder eines (evtl. alten) Backups mit Standardwerten auf,
 * damit die App nach dem Wiederherstellen nicht abstuerzt.
 */
export function normalizeAppState(input: any): AppState {
  const src = (input && typeof input === 'object') ? input : {};
  const merged: any = { ...INITIAL_STATE, ...src };

  // profile inkl. verschachtelter Objekte
  const srcProfile = (src.profile && typeof src.profile === 'object') ? src.profile : {};
  merged.profile = {
    ...INITIAL_STATE.profile,
    ...srcProfile,
    tires: {
      ...INITIAL_STATE.profile.tires,
      ...((srcProfile.tires && typeof srcProfile.tires === 'object') ? srcProfile.tires : {})
    },
    axleLoads: {
      ...INITIAL_STATE.profile.axleLoads,
      ...((srcProfile.axleLoads && typeof srcProfile.axleLoads === 'object') ? srcProfile.axleLoads : {})
    }
  };

  // sos inkl. Listen
  const srcSos = (src.sos && typeof src.sos === 'object') ? src.sos : {};
  merged.sos = { ...INITIAL_STATE.sos, ...srcSos };
  if (!Array.isArray(merged.sos.gear)) merged.sos.gear = [...INITIAL_STATE.sos.gear];
  if (!Array.isArray(merged.sos.pharmacy)) merged.sos.pharmacy = [];

  // Lagerorte: Objekt, jede Kategorie muss ein Array sein
  const srcSubs = (src.subcategories && typeof src.subcategories === 'object') ? src.subcategories : {};
  merged.subcategories = { ...INITIAL_STATE.subcategories, ...srcSubs };
  for (const key of Object.keys(merged.subcategories)) {
    if (!Array.isArray(merged.subcategories[key])) merged.subcategories[key] = [];
  }

  // Wechselkurse
  if (!merged.exchangeRates || typeof merged.exchangeRates !== 'object') {
    merged.exchangeRates = { ...INITIAL_STATE.exchangeRates };
  }

  // alle Listen absichern
  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(merged[field])) {
      const fallback = (INITIAL_STATE as any)[field];
      merged[field] = Array.isArray(fallback) ? [...fallback] : [];
    }
  }

  // Fuellstaende muessen Zahlen sein
  for (const field of LEVEL_FIELDS) {
    if (typeof merged[field] !== 'number' || isNaN(merged[field])) {
      merged[field] = (INITIAL_STATE as any)[field];
    }
  }

  return merged as AppState;
}
