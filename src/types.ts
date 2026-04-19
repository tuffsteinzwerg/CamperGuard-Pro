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
  unit: 'g' | 'kg' | 'stk';
  category: string;
  subcategory: string;
}

export type FuelType = 'Diesel' | 'Benzin' | 'Super E10' | 'Super E5' | 'AdBlue';
export type Currency = 'EUR' | 'CHF' | 'TRY' | 'HRK' | 'DKK' | 'SEK' | 'NOK' | 'PLN' | 'GBP';

export interface FuelEntry {
  id: string;
  date: string;
  km: number;
  liters: number;
  price: number; // original price in currency
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
}

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
  location: string;
  checked: boolean;
}

export interface PharmacyItem {
  id: string;
  name: string;
  purpose: string;
  expiry: string;
  location: string;
  quantity: number;
  unit: 'stk' | 'ml';
}

export interface SosData {
  name: string;
  address: string;
  iceName: string;
  icePhone: string;
  bloodGroup: string;
  medicalConditions: string;
  gear: EmergencyGear[];
  pharmacy: PharmacyItem[];
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
  maxWeight: number; // zGG
  emptyWeight: number;
  axleLoads: { front: number; rear: number };
  fuelCapacity: number;
  adBlueCapacity: number;
  isTwinTires: boolean;
  tires: Record<TireProfile, TirePressures>;
}

export interface AppState {
  profile: ProfileData;
  inventory: InventoryItem[];
  subcategories: Record<string, string[]>;
  fuelLog: FuelEntry[];
  tripLog: TripEntry[];
  archives: YearArchive[];
  spots: SpotEntry[];
  faqs: FAQEntry[];
  checklist: { id: string; label: string; checked: boolean }[];
  waterLevel: number; // 0, 25, 50, 75, 100
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
    maxWeight: 0,
    emptyWeight: 0,
    axleLoads: { front: 0, rear: 0 },
    fuelCapacity: 0,
    adBlueCapacity: 0,
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
  maintenance: [
    { id: 'tuev', name: 'TÜV', date: "" },
    { id: 'gas', name: 'Gasprüfung', date: "" },
    { id: 'dicht', name: 'Dichtigkeit', date: "" },
    { id: 'service', name: 'Service', date: "" }
  ],
  exchangeRates: {},
  sos: {
    name: "", address: "", iceName: "", icePhone: "", bloodGroup: "", medicalConditions: "",
    gear: [
      { id: 'g1', name: 'Feuerlöscher', location: '', checked: false },
      { id: 'g2', name: 'Warnwesten', location: '', checked: false },
      { id: 'g3', name: 'Erste-Hilfe-Kasten', location: '', checked: false },
      { id: 'g4', name: 'Warndreieck', location: '', checked: false }
    ],
    pharmacy: []
  }
};
