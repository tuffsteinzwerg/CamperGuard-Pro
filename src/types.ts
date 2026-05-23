import { LucideIcon } from 'lucide-react';

export interface MaintenanceItem {
  id: string;
  name: string;
  date: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'g' | 'kg' | 'stk' | 'gr' | 'Stk';
  category: string;
  subcategory: string;
  weight?: number;
  weightUnit?: 'kg' | 'g' | 'gr';
}

export type FuelType = 'Diesel' | 'Benzin' | 'Super E10' | 'Super E5';
export type Currency = 'EUR' | 'CHF' | 'TRY' | 'DKK' | 'SEK' | 'NOK' | 'PLN' | 'GBP';

export interface FuelEntry {
  id: string;
  date: string;
  km: number;
  liters: number;
  price: number; // original price in currency
  vollgetankt: boolean;
  currency: Currency;
  exchangeRateToEur: number; // multiplier to get EUR
  fuelType: FuelType;
}

export interface TripEntry {
  id: string;
  date: string;
  fromKm: number;
  toKm: number;
  purpose: string;
  destination: string;
  lat?: number;
  lng?: number;
}

export interface BusinessTripEntry {
  id: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  driver: string;
  fromKm: number;
  toKm: number;
  category: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  purpose: string;
  businessPartner: string;
  note: string;
}

export interface ArchiveSummary {
  totalKm: number;
  totalLiters: number;
  totalEur: number;
  fuelConsumption: number | null;
}

export interface Archive {
  id: string;
  type: 'year' | 'trip' | 'fuel' | 'triplog' | 'business' | 'spots';
  name: string;
  year?: number;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
  fuelLog: FuelEntry[];
  tripLog: TripEntry[];
  businessTripLog: BusinessTripEntry[];
  spots: SpotEntry[];
  summary: ArchiveSummary;
}

// Legacy-Format vor Archiv-Umbau.
// Nur für Migration alter IndexedDB-Daten behalten.
export interface YearArchive {
  year: number;
  totalKm: number;
  totalLiters: number;
  totalEur: number;
  fuelLog: FuelEntry[];
  tripLog: TripEntry[];
}

export interface SpotEntry {
  id: string;
  name: string;
  lat: number;
  lng: number;
  date: string;
  note: string;
  category?: string;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
}

export type TireProfile = 'Straße' | 'Sand/Dünen' | 'Schlamm/Matsch' | 'Felsgelände' | 'Geröll/Schotter' | 'Wasser/Furten' | 'Schnee/Eis' | 'Erde/Wiese';

export interface EmergencyGear {
  id: string;
  name: string;
  checked: boolean;
  count: number;
  locations: string[];
  weight?: number | string;
  weightUnit?: string;
}

export interface PharmacyItem {
  id: string;
  name: string;
  purpose: string;
  expiry: string;
  location: string;
  quantity: number;
  unit: 'stk' | 'ml';
  weight?: number | string;
  weightUnit?: string;
}

export interface SosData {
  address?: string;
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  country: string;
  ice1Name: string;
  ice1Phone: string;
  ice2Name: string;
  ice2Phone: string;
  bloodGroup: string;
  medicalConditions: string;
  medications: string;
  gear: EmergencyGear[];
  deletedGear?: string[];
  pharmacy: PharmacyItem[];
  gpsEnabled?: boolean;
  homeCoords?: { lat: number; lng: number } | null;
}

export interface TirePressures {
  frontLeft: number;
  frontRight: number;
  rearLeft: number;
  rearRight: number;
  rearLeftOuter?: number;
  rearRightOuter?: number;
}

export interface ProfileData {
  vehicleName: string;
  plate: string;
  height: number;
  width: number;
  length: number;
  trackWidth: number;
  wheelbase: number;
  maxWeight: number; // zGG
  emptyWeight: number;
  axleLoads: { front: number; rear: number };
  freshWaterCapacity: number;
  wasteWaterCapacity: number;
  dieselCapacity: number;
  pitchOffset?: number;
  rollOffset?: number;
  isTwinTires: boolean;
  tires: Record<TireProfile, TirePressures>;
}

export interface AppState {
  profile: ProfileData;
  inventory: InventoryItem[];
  subcategories: Record<string, string[]>;
  fuelLog: FuelEntry[];
  tripLog: TripEntry[];
  businessTripLog: BusinessTripEntry[];
  archives: Archive[];
  spots: SpotEntry[];
  faqs: FAQEntry[];
  checklist: { id: string; label: string; checked: boolean }[];
  waterLevel: number; // 0, 25, 50, 75, 100
  wasteWaterLevel: number; // 0, 25, 50, 75, 100
  dieselLevel: number; // 0-100, 10er-Schritte
  maintenance: MaintenanceItem[];
  exchangeRates: Record<string, number>;
  sos: SosData;
}

const DEFAULT_TIRES: TirePressures = {
  frontLeft: 4.5, frontRight: 4.5, rearLeft: 5.0, rearRight: 5.0
};

export const INITIAL_STATE: AppState = {
  profile: {
    vehicleName: "",
    plate: "",
    height: 0,
    width: 0,
    length: 0,
    trackWidth: 0,
    wheelbase: 0,
    maxWeight: 0,
    emptyWeight: 0,
    axleLoads: { front: 0, rear: 0 },
    freshWaterCapacity: 0,
    wasteWaterCapacity: 0,
    dieselCapacity: 0,
    pitchOffset: 0,
    rollOffset: 0,
    isTwinTires: false,
    tires: {
      'Straße': { ...DEFAULT_TIRES },
      'Sand/Dünen': { ...DEFAULT_TIRES, frontLeft: 2.5, frontRight: 2.5, rearLeft: 3.0, rearRight: 3.0 },
      'Schlamm/Matsch': { ...DEFAULT_TIRES },
      'Felsgelände': { ...DEFAULT_TIRES },
      'Geröll/Schotter': { ...DEFAULT_TIRES, frontLeft: 3.5, frontRight: 3.5, rearLeft: 4.0, rearRight: 4.0 },
      'Wasser/Furten': { ...DEFAULT_TIRES },
      'Schnee/Eis': { ...DEFAULT_TIRES },
      'Erde/Wiese': { ...DEFAULT_TIRES }
    }
  },
  inventory: [],
  subcategories: {
    "Küche": [],
    "Garage": [],
    "Technik": [],
    "Wohnen": [],
    "Bad": []
  },
  fuelLog: [],
  tripLog: [],
  businessTripLog: [],
  archives: [],
  spots: [],
  faqs: [
    { id: '1', question: 'Wie funktioniert die Wasserwaage?', answer: 'Lege das Gerät flach auf einen Tisch im Camper (ggf. Längs- oder Quer-Ausrichtung beachten).' }
  ],
  checklist: [
    { id: 'gas', label: 'Gasflaschen geschlossen', checked: false },
    { id: 'fenster', label: 'Fenster & Luken zu', checked: false },
    { id: 'strom', label: 'Landstrom getrennt', checked: false },
    { id: 'schraenke', label: 'Schränke verriegelt', checked: false },
    { id: 'keile', label: 'Keile/Stützen entfernt', checked: false },
    { id: 'treppe', label: 'Trittstufe eingefahren', checked: false }
  ],
  waterLevel: 50,
  wasteWaterLevel: 0,
  dieselLevel: 50,
  maintenance: [
    { id: 'tuev', name: 'TÜV', date: "" },
    { id: 'gas', name: 'Gasprüfung', date: "" },
    { id: 'dicht', name: 'Dichtigkeit', date: "" },
    { id: 'service', name: 'Service', date: "" }
  ],
  exchangeRates: {},
  sos: {
    address: "", firstName: "", lastName: "", street: "", houseNumber: "", zipCode: "", city: "", country: "",
    ice1Name: "", ice1Phone: "", ice2Name: "", ice2Phone: "", 
    bloodGroup: "", medicalConditions: "", medications: "",
    gear: [
      { id: 'g1', name: 'Feuerlöscher', count: 0, locations: [], checked: false, weight: '', weightUnit: 'kg' },
      { id: 'g2', name: 'Feuerlöschdecke', count: 0, locations: [], checked: false, weight: '', weightUnit: 'kg' },
      { id: 'g3', name: 'Warnweste', count: 0, locations: [], checked: false, weight: '', weightUnit: 'kg' },
      { id: 'g4', name: 'Erste-Hilfe-Kasten', count: 0, locations: [], checked: false, weight: '', weightUnit: 'kg' },
      { id: 'g5', name: 'Warndreieck', count: 0, locations: [], checked: false, weight: '', weightUnit: 'kg' }
    ],
    pharmacy: []
  }
};
