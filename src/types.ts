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

export interface FuelEntry {
  id: string;
  date: string;
  km: number;
  liters: number;
  price: number;
  full: boolean;
}

export interface TripEntry {
  id: string;
  date: string;
  fromKm: number;
  toKm: number;
  purpose: string;
  destination: string;
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
  tirePressures: {
    road: string;
    gravel: string;
    sand: string;
    emergency: string;
  };
}

export interface AppState {
  profile: ProfileData;
  inventory: InventoryItem[];
  subcategories: Record<string, string[]>;
  fuelLog: FuelEntry[];
  tripLog: TripEntry[];
  checklist: { id: string; label: string; checked: boolean }[];
  waterLevel: number; // 0, 25, 50, 75, 100
  maintenance: MaintenanceItem[];
}

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
    tirePressures: {
      road: "4.5 / 5.0",
      gravel: "3.5 / 4.0",
      sand: "2.5 / 3.0",
      emergency: "1.5 / 2.0"
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
  ]
};
