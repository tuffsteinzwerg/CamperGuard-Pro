/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ShieldCheck, 
  Settings, 
  Map as MapIcon, 
  BookOpen, 
  Package, 
  Activity, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Save, 
  Search, 
  Droplets, 
  Truck, 
  Navigation, 
  AlertTriangle,
  FileDown,
  ChevronDown,
  ChevronUp,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { INITIAL_STATE, AppState, InventoryItem, FuelEntry, TripEntry } from './types.ts';

// Fix Leaflet icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Global map reference
let globalLeafletMap: L.Map | null = null;

// Audio Synthesis for "Vroom" sound
const playEngineSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(40, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 1);
    oscillator.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 2.5);
    oscillator.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 3);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 3);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 3);
  } catch (e) {
    console.warn("Audio synthesis failed:", e);
  }
};

// --- Components ---

const ViewTitle = ({ children }: { children: React.ReactNode }) => (
  <h1 className="text-sm font-black mb-4 text-orange-500 uppercase tracking-[0.2em] px-2">{children}</h1>
);

const Card = (props: any) => {
  const { children, className, ...rest } = props;
  return (
    <div className={`bg-[#2a2a2a] rounded-lg p-4 border border-[#3d3d3d] ${className || ""}`} {...rest}>
      {children}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'inhalt' | 'logbuch' | 'reise' | 'profil'>('status');

  useEffect(() => {
    if (activeTab === 'reise') {
        if (globalLeafletMap) {
            console.log('Zwinge Leaflet zur Größenkorrektur...');
            globalLeafletMap.invalidateSize();
        }
    }
  }, [activeTab]);
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('camperguard_state');
    return saved ? JSON.parse(saved) : INITIAL_STATE;
  });

  // Leveling sensors
  const [orientation, setOrientation] = useState({ pitch: 0, roll: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      playEngineSound();
    }, 3000);

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Basic pitch/roll from beta/gamma
      setOrientation({
        pitch: e.beta || 0,
        roll: e.gamma || 0
      });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('camperguard_state', JSON.stringify(state));
  }, [state]);

  const demoSeed = () => {
    const demoState: AppState = {
      ...INITIAL_STATE,
      profile: {
        vehicleName: "HECTOR",
        plate: "M-CG 2024",
        height: 3.2,
        width: 2.35,
        length: 7.4,
        maxWeight: 3500,
        emptyWeight: 2950,
        axleLoads: { front: 1850, rear: 2000 },
        fuelCapacity: 90,
        adBlueCapacity: 19,
        tirePressures: {
          road: "4.5 / 5.0",
          gravel: "3.5 / 4.0",
          sand: "2.5 / 3.0",
          emergency: "1.5 / 2.0"
        }
      },
      inventory: [
        { id: '1', name: 'Nudeln', quantity: 2, unit: 'kg', category: 'Küche', subcategory: 'Box A' },
        { id: '2', name: 'Gasflasche', quantity: 1, unit: 'stk', category: 'Technik', subcategory: 'Gaskasten' },
        { id: '3', name: 'Campingtisch', quantity: 1, unit: 'stk', category: 'Garage', subcategory: 'Möbel' }
      ],
      subcategories: {
        "Küche": ["Box A", "Gewürze"],
        "Garage": ["Möbel", "Werkzeug"],
        "Technik": ["Gaskasten", "Elektro"],
        "Wohnen": ["Bett", "Sitzbank"],
        "Bad": ["Hygiene", "Medizin"]
      },
      fuelLog: [
          { id: 'f1', date: '2024-03-10', km: 12500, liters: 75, price: 1.65, full: true },
          { id: 'f2', date: '2024-03-25', km: 13200, liters: 68, price: 1.72, full: true }
      ],
      tripLog: [],
      waterLevel: 50,
      checklist: [
        { id: 'gas', label: 'Gasflaschen geschlossen', checked: false },
        { id: 'fenster', label: 'Fenster & Luken zu', checked: true },
        { id: 'strom', label: 'Landstrom getrennt', checked: false },
        { id: 'schraenke', label: 'Schränke verriegelt', checked: true },
        { id: 'keile', label: 'Keile/Stützen entfernt', checked: false },
        { id: 'treppe', label: 'Trittstufe eingefahren', checked: false }
      ],
      maintenance: [
        { id: 'tuev', name: 'TÜV', date: "2025-06-01" },
        { id: 'gas', name: 'Gasprüfung', date: "2025-06-01" },
        { id: 'dicht', name: 'Dichtigkeit', date: "2024-12-15" },
        { id: 'service', name: 'Service', date: "2025-03-01" }
      ]
    };
    setState(demoState);
    alert("Demo-Daten geladen!");
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col items-center justify-center z-50 overflow-hidden">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-orange-500 rounded-3xl flex items-center justify-center shadow-2xl mb-6">
            <ShieldCheck className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-widest text-center">
            CAMPERGUARD <span className="text-orange-500 italic font-light">PRO</span>
          </h1>
          <motion.div 
            className="mt-8 flex gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-orange-500 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 lg:max-w-none max-w-md mx-auto relative bg-[#1a1a1a]">
      {/* Header */}
      <header className="h-[60px] px-4 bg-[#111] border-b-2 border-orange-500 sticky top-0 z-40 flex justify-between items-center no-print">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-orange-500" size={20} />
          <span className="font-black text-sm uppercase tracking-[0.1em] text-orange-500">
            {state.profile.vehicleName || "Camper"} <span className="text-gray-700 mx-1">|</span> {state.profile.plate || "M-CG 2024"}
          </span>
        </div>
        <button onClick={() => setActiveTab('profil')} className="p-2 rounded bg-black/40 border border-[#3d3d3d] active:scale-95 transition-all text-gray-400">
          <Settings size={16} />
        </button>
      </header>

      {/* Main Content */}
      <main className="p-4 overflow-y-auto lg:max-w-6xl lg:mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'status' && <StatusView state={state} setState={setState} orientation={orientation} />}
            {activeTab === 'inhalt' && <InhaltView state={state} setState={setState} />}
            {activeTab === 'logbuch' && <LogbuchView state={state} setState={setState} />}
            {activeTab === 'reise' && <ReiseView state={state} />}
            {activeTab === 'profil' && <ProfilView state={state} setState={setState} demoSeed={demoSeed} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none bg-[#111] border-t border-[#3d3d3d] h-[70px] px-4 flex justify-between items-center z-40 no-print">
        <NavButton active={activeTab === 'status'} onClick={() => setActiveTab('status')} icon={<Activity size={20} />} label="Status" />
        <NavButton active={activeTab === 'inhalt'} onClick={() => setActiveTab('inhalt')} icon={<Package size={24} />} label="Inhalt" />
        <NavButton active={activeTab === 'logbuch'} onClick={() => setActiveTab('logbuch')} icon={<BookOpen size={24} />} label="Logbuch" />
        <NavButton active={activeTab === 'reise'} onClick={() => setActiveTab('reise')} icon={<MapIcon size={24} />} label="Reise" />
        <NavButton active={activeTab === 'profil'} onClick={() => setActiveTab('profil')} icon={<Settings size={24} />} label="Profil" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center gap-1 transition-all ${active ? 'text-orange-500' : 'text-gray-500'}`}>
      <motion.div animate={active ? { scale: 1.1 } : { scale: 1 }}>{icon}</motion.div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-indicator" className="w-4 h-0.5 bg-orange-500 mt-1" />}
    </button>
  );
}

// --- TAB: STATUS ---

function StatusView({ state, setState, orientation }: { state: AppState, setState: any, orientation: { pitch: number, roll: number } }) {
  const [showTireModal, setShowTireModal] = useState(false);
  
  const pitchNormalized = Math.max(-10, Math.min(10, orientation.pitch));
  const rollNormalized = Math.max(-10, Math.min(10, orientation.roll));
  
  const isLevel = Math.abs(orientation.pitch) < 1.0 && Math.abs(orientation.roll) < 1.0;

  const waterWeightImpact = (state.waterLevel / 100) * (state.profile.fuelCapacity || 100);
  const totalWeight = (state.profile.emptyWeight || 0) + waterWeightImpact; // Simplified

  return (
    <div className="high-density-grid">
      {/* Column 1: Nivellierung & Wasser */}
      <Card className="flex flex-col">
        <div className="text-[0.75rem] uppercase text-gray-400 font-semibold mb-3 tracking-widest">Nivellierung & Wasser</div>
        <div className="relative w-[180px] h-[180px] rounded-full border-4 border-[#3d3d3d] bg-[radial-gradient(circle,#222_0%,#111_100%)] mx-auto overflow-hidden">
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-orange-500/20 -translate-x-1/2" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-orange-500/20 -translate-y-1/2" />
            <motion.div 
              animate={{ 
                x: rollNormalized * 7.5, 
                y: pitchNormalized * 7.5 
              }}
              className={`absolute top-1/2 left-1/2 -mt-[15px] -ml-[15px] w-[30px] h-[30px] rounded-full shadow-[0_0_15px_#FF9800] bg-orange-500`}
            />
        </div>
        <div className="flex justify-between font-mono mt-4 mb-6 px-4">
            <div className="text-center">
                <div className="text-[0.6rem] text-gray-500 uppercase">PITCH</div>
                <div className={`text-sm ${Math.abs(orientation.pitch) < 1 ? 'text-green-500' : 'text-white'}`}>{orientation.pitch > 0 ? '+' : ''}{orientation.pitch.toFixed(1)}°</div>
            </div>
            <div className="text-center">
                <div className="text-[0.6rem] text-gray-500 uppercase">ROLL</div>
                <div className={`text-sm ${Math.abs(orientation.roll) < 1 ? 'text-green-500' : 'text-white'}`}>{orientation.roll > 0 ? '+' : ''}{orientation.roll.toFixed(1)}°</div>
            </div>
        </div>
        
        <div className="space-y-4">
            <div>
                <div className="text-[0.65rem] uppercase text-gray-500 font-bold mb-2">Frischwasser</div>
                <input 
                    type="range" min="0" max="100" step="25"
                    value={state.waterLevel}
                    onChange={(e) => setState({...state, waterLevel: parseInt(e.target.value)})}
                    className="w-full accent-orange-500 h-2 bg-[#444] rounded-full appearance-none cursor-pointer"
                />
                <div className="flex justify-between items-center mt-2">
                    <span className="text-xs font-bold">{state.waterLevel}% ({waterWeightImpact.toFixed(0)}L)</span>
                    <span className="bg-black text-orange-500 text-[0.9rem] px-2 py-0.5 rounded font-mono font-bold">+ {waterWeightImpact.toFixed(1)} kg</span>
                </div>
            </div>
            
            <div className="pt-4 border-t border-[#3d3d3d]">
                <div className="text-[0.65rem] uppercase text-gray-500 font-bold mb-1">Gesamtgewicht</div>
                <div className="text-2xl font-black text-orange-500">
                    {totalWeight.toLocaleString('de-DE')} <span className="text-sm font-normal text-gray-500">/ {state.profile.maxWeight || 3500} kg</span>
                </div>
            </div>
        </div>
      </Card>

      {/* Column 2: Status Dashboard */}
      <Card className="flex flex-col h-full">
        <div className="text-[0.75rem] uppercase text-gray-400 font-semibold mb-3 tracking-widest">Status Dashboard</div>
        <div className="grid grid-cols-2 gap-2 mb-6">
            {state.maintenance.map(item => {
                const date = item.date ? new Date(item.date) : null;
                const today = new Date();
                const diffInDays = date ? (date.getTime() - today.getTime()) / (1000 * 3600 * 24) : 999;
                const type = diffInDays < 15 ? 'danger' : diffInDays < 60 ? 'warning' : 'success';
                const borderColor = type === 'danger' ? 'border-b-[#F44336]' : type === 'warning' ? 'border-b-[#FFC107]' : 'border-b-[#4CAF50]';
                
                return (
                    <div key={item.id} className={`bg-[#333] p-3 rounded flex flex-col items-center gap-1 border-b-4 ${borderColor}`}>
                        <span className="text-[0.65rem] text-gray-500 uppercase font-bold">{item.name}</span>
                        <span className="text-[0.85rem] font-bold">{item.date ? new Date(item.date).toLocaleDateString('de-DE', { month: '2-digit', year: '2-digit' }) : 'N/A'}</span>
                    </div>
                );
            })}
        </div>
        
        <div className="text-[0.65rem] uppercase text-gray-500 font-bold mb-2">Aktuelle Route</div>
        <div className="flex-1 min-h-[120px] bg-[#111] border border-[#444] rounded relative flex items-center justify-center overflow-hidden">
            <div className="text-gray-700 text-[10px] font-black tracking-widest text-center px-4">DARK MODE NAVIGATION ACTIVE</div>
            <Navigation className="absolute text-orange-500 top-1/3 left-1/2" size={24} />
        </div>
        <div className="flex justify-between items-center mt-3">
            <div>
                <div className="text-[0.65rem] text-gray-500 uppercase">Ziel: Camping Alpina</div>
                <div className="text-sm font-bold tracking-tight">245 km | 3h 15m</div>
            </div>
            <div className="text-[#4CAF50] font-bold text-[0.8rem] uppercase">Reichweite OK</div>
        </div>
      </Card>

      {/* Column 3: Checkliste & Tools */}
      <Card className="flex flex-col h-full">
        <div className="text-[0.75rem] uppercase text-gray-400 font-semibold mb-3 tracking-widest">Abfahrt-Checkliste</div>
        <div className="flex-1 divide-y divide-[#333]">
            {state.checklist.slice(0, 4).map(item => {
                const isCriticalPulsing = !item.checked && item.id === 'keile' && isLevel;
                return (
                    <div 
                        key={item.id}
                        onClick={() => {
                            const newChecklist = state.checklist.map(c => c.id === item.id ? {...c, checked: !c.checked} : c);
                            setState({...state, checklist: newChecklist});
                        }}
                        className={`py-2 px-1 flex items-center gap-3 cursor-pointer group hover:bg-black/20 ${isCriticalPulsing ? 'animate-pulse text-red-500' : ''}`}
                    >
                        <div className={`w-[18px] h-[18px] border-2 border-orange-500 rounded-sm relative flex items-center justify-center transition-colors ${item.checked ? 'bg-orange-500/20' : 'bg-transparent'}`}>
                             {item.checked && <span className="text-orange-500 text-[12px] font-black absolute -top-1">✓</span>}
                        </div>
                        <span className={`text-[0.85rem] ${item.checked ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{item.label}</span>
                    </div>
                );
            })}
        </div>

        <div className="mt-6">
            <div className="text-[0.75rem] uppercase text-gray-400 font-semibold mb-2 tracking-widest">Letzte Log-Einträge</div>
            <div className="space-y-1 font-mono text-[0.75rem]">
                <div className="py-1.5 border-b border-[#333] flex justify-between">
                    <span className="text-gray-500">12.05.</span>
                    <span className="flex-1 px-2">Tanken: Shell</span>
                    <span className="text-orange-500">12.4L</span>
                </div>
                <div className="py-1.5 border-b border-[#333] flex justify-between">
                    <span className="text-gray-500">10.05.</span>
                    <span className="flex-1 px-2">Kroatien Trip</span>
                    <span className="text-orange-500">420km</span>
                </div>
            </div>
        </div>

        <button 
          onClick={() => setShowTireModal(true)}
          className="w-full mt-auto bg-orange-500 text-black font-black py-2.5 rounded text-sm uppercase tracking-widest hover:bg-orange-600 transition-colors"
        >
          Reifendruck-Tabelle
        </button>
      </Card>

      {/* Tire modal */}
      <AnimatePresence>
        {showTireModal && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
            >
                <motion.div 
                    initial={{ scale: 0.9, y: 50 }} 
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 50 }}
                    className="bg-[#2a2a2a] w-full max-w-sm rounded-[2rem] border border-[#3a3a3a] shadow-2xl p-8"
                >
                    <h2 className="text-2xl font-black text-orange-500 mb-8 tracking-tight uppercase">Luftdruck-Setup</h2>
                    <div className="space-y-6">
                        {Object.entries({
                            "Straße / Autobahn": state.profile.tirePressures.road,
                            "Schotter / Piste": state.profile.tirePressures.gravel,
                            "Weicher Sand": state.profile.tirePressures.sand,
                            "Notfall / Bergung": state.profile.tirePressures.emergency
                        }).map(([label, val]) => (
                            <div key={label} className="flex justify-between items-center group">
                                <span className="text-gray-500 text-sm font-black uppercase tracking-widest">{label}</span>
                                <span className="text-white font-mono text-xl font-black">{val} <span className="text-[10px] text-gray-500">bar</span></span>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => setShowTireModal(false)}
                        className="w-full mt-12 bg-white text-black font-black py-4 rounded-2xl hover:bg-orange-500 hover:text-white transition-colors uppercase tracking-widest text-sm"
                    >
                        Fertig
                    </button>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- TAB: INHALT ---

function InhaltView({ state, setState }: { state: AppState, setState: any }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Küche");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");

  const categories = ["Küche", "Garage", "Technik", "Wohnen", "Bad"];

  const filteredItems = state.inventory.filter(item => 
    item.category === activeCategory && 
    (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     item.subcategory.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedBySub = useMemo(() => {
    const groups: Record<string, InventoryItem[]> = {};
    (state.subcategories[activeCategory] || []).forEach(sub => groups[sub] = []);
    groups["Unkategorisiert"] = [];
    
    filteredItems.forEach(item => {
        if (groups[item.subcategory]) {
            groups[item.subcategory].push(item);
        } else {
            groups["Unkategorisiert"].push(item);
        }
    });
    return groups;
  }, [filteredItems, activeCategory, state.subcategories]);

  const addItem = (e: React.FormEvent<any>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newItem: InventoryItem = {
        id: Date.now().toString(),
        name: fd.get('name') as string,
        quantity: parseFloat(fd.get('qty') as string),
        unit: fd.get('unit') as 'g' | 'kg' | 'stk',
        category: activeCategory,
        subcategory: fd.get('sub') as string,
    };
    setState({...state, inventory: [...state.inventory, newItem]});
    setIsAddingItem(false);
  };

  const deleteItem = (id: string) => {
    setState({...state, inventory: state.inventory.filter(i => i.id !== id)});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end no-print">
        <ViewTitle>Inventar</ViewTitle>
        <button onClick={() => window.print()} className="mb-6 p-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] text-gray-500 hover:text-white transition-colors">
            <Printer size={18} />
        </button>
      </div>

      <div className="relative no-print">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" size={14} />
        <input 
            type="text" placeholder="BESTAND DURCHSUCHEN..."
            className="hd-input w-full pl-10 pr-4 py-2.5 uppercase text-[10px] font-bold tracking-tighter"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 no-print hide-scrollbar">
        {categories.map(cat => (
            <button 
                key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded border text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all active:scale-95 ${activeCategory === cat ? 'bg-orange-500 border-orange-500 text-black' : 'bg-[#2a2a2a] border-[#3d3d3d] text-gray-500'}`}
            >
                {cat}
            </button>
        ))}
      </div>

                <div className="space-y-4">
                {(state.subcategories[activeCategory] as string[] || []).map(sub => (
                    <div key={sub} className="space-y-2">
                        <div className="flex justify-between items-baseline px-1 border-b border-[#3d3d3d] pb-1">
                            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">{sub}</h3>
                            <span className="text-[9px] text-gray-700 font-mono font-bold uppercase">{(groupedBySub[sub] || []).length} Posten</span>
                        </div>
                        <div className="space-y-1">
                            {(groupedBySub[sub] || []).map(item => (
                                <div key={item.id} className="flex justify-between items-center px-3 py-2 bg-[#2a2a2a] rounded border border-[#3d3d3d] group">
                                    <span className="font-bold text-xs tracking-tight">{item.name}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-black font-mono text-orange-500 bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/20">
                                            {item.quantity} <span className="text-[8px] opacity-70 italic">{item.unit}</span>
                                        </span>
                                        <button onClick={() => deleteItem(item.id)} className="text-gray-700 hover:text-red-500 transition-colors no-print">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                
                {/* Unkategorisiert */}
                {groupedBySub["Unkategorisiert"] && groupedBySub["Unkategorisiert"].length > 0 && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-baseline px-1 border-b border-[#3a3a3a] pb-2">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Unkategorisiert</h3>
                            <span className="text-[10px] text-gray-600 font-mono font-bold uppercase">{groupedBySub["Unkategorisiert"].length} Posten</span>
                        </div>
                        <div className="space-y-2">
                            {groupedBySub["Unkategorisiert"].map(item => (
                                <div key={item.id} className="flex justify-between items-center p-4 bg-[#2a2a2a] rounded-2xl border border-[#3a3a3a] group">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm tracking-tight">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <span className="text-sm font-black font-mono text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">
                                            {item.quantity} <span className="text-[10px] opacity-70 italic">{item.unit}</span>
                                        </span>
                                        <button onClick={() => deleteItem(item.id)} className="text-gray-700 hover:text-red-500 transition-colors no-print">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                </div>

      <div className="flex gap-3 no-print pt-6 sticky bottom-4">
          <button 
            onClick={() => setIsAddingSub(true)}
            className="flex-1 bg-[#2a2a2a] border border-dashed border-[#444] text-gray-500 p-3 rounded flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            <Plus size={14} /> Gruppe
          </button>
          <button 
            onClick={() => setIsAddingItem(true)}
            className="hd-button flex-[2] flex items-center justify-center gap-2 py-3"
          >
            <Plus size={16} /> Artikel hinzufügen
          </button>
      </div>

      {/* Modals for adding */}
      <AnimatePresence>
        {isAddingItem && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
            >
                <div className="bg-[#2a2a2a] w-full max-w-sm rounded-lg border border-[#3d3d3d] p-6 space-y-4 shadow-2xl">
                    <h2 className="text-sm font-black text-orange-500 mb-4 uppercase tracking-[0.2em]">Neuer Artikel</h2>
                    <div>
                        <label className="hd-label">Name</label>
                        <input name="name" required placeholder="z.B. Espresso" className="hd-input w-full p-2.5" />
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="hd-label">Menge</label>
                            <input name="qty" required type="number" step="0.1" className="hd-input w-full p-2.5" />
                        </div>
                        <div className="w-1/3">
                            <label className="hd-label">Unit</label>
                            <select name="unit" className="hd-input w-full p-2.5 appearance-none">
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="stk">Stk</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="hd-label">Gruppe</label>
                        <select name="sub" className="hd-input w-full p-2.5 appearance-none">
                            <option value="Unkategorisiert">Untergruppe wählen...</option>
                            {(state.subcategories[activeCategory] || []).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsAddingItem(false)} className="hd-button-secondary flex-1">Abbrechen</button>
                        <button type="submit" className="hd-button flex-1" onClick={(e: any) => {
                             const form = e.target.closest('form');
                             if(form) addItem({ preventDefault: () => {}, currentTarget: form } as any);
                        }}>Sichern</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingSub && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            >
                <div className="bg-[#2a2a2a] w-full max-w-sm rounded-[2rem] border border-[#3a3a3a] p-8 space-y-5">
                    <h2 className="text-xl font-black text-orange-500 mb-6 uppercase">Neue Gruppe</h2>
                    <input 
                        value={newSubName} onChange={e => setNewSubName(e.target.value)}
                        placeholder="Name (z.B. Schublade 1)" className="w-full bg-black/30 border border-[#3a3a3a] rounded-2xl px-5 py-4 outline-none focus:border-orange-500" 
                    />
                    <div className="flex gap-3 pt-6">
                        <button onClick={() => setIsAddingSub(false)} className="flex-1 bg-gray-800 py-4 rounded-2xl font-black text-xs uppercase">Stop</button>
                        <button 
                            onClick={() => {
                                if(!newSubName) return;
                                const subs = {...state.subcategories};
                                subs[activeCategory] = [...(subs[activeCategory] || []), newSubName];
                                setState({...state, subcategories: subs});
                                setNewSubName("");
                                setIsAddingSub(false);
                            }} 
                            className="flex-1 bg-orange-500 py-4 rounded-2xl font-black text-xs uppercase"
                        >
                            Okay
                        </button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- TAB: LOGBUCH ---

function LogbuchView({ state, setState }: { state: AppState, setState: any }) {
  const [logType, setLogType] = useState<'tank' | 'fahrt'>('tank');
  const [isAdding, setIsAdding] = useState(false);

  const avgConsumption = useMemo(() => {
    if (state.fuelLog.length < 2) return 0;
    const sorted = [...state.fuelLog].sort((a,b) => b.km - a.km);
    const totalDist = sorted[0].km - sorted[sorted.length - 1].km;
    const totalLiters = sorted.slice(0, -1).reduce((acc, curr) => acc + curr.liters, 0);
    return totalDist > 0 ? (totalLiters / totalDist) * 100 : 0;
  }, [state.fuelLog]);

  const addFuel = (e: React.FormEvent<any>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const entry: FuelEntry = {
          id: Date.now().toString(),
          date: fd.get('date') as string,
          km: parseFloat(fd.get('km') as string),
          liters: parseFloat(fd.get('liters') as string),
          price: parseFloat(fd.get('price') as string),
          full: fd.get('full') === 'on'
      };
      setState({...state, fuelLog: [entry, ...state.fuelLog]});
      setIsAdding(false);
  };

  const addTrip = (e: React.FormEvent<any>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const entry: TripEntry = {
          id: Date.now().toString(),
          date: fd.get('date') as string,
          fromKm: parseFloat(fd.get('from') as string),
          toKm: parseFloat(fd.get('to') as string),
          purpose: fd.get('purpose') as string,
          destination: fd.get('destination') as string
      };
      setState({...state, tripLog: [entry, ...state.tripLog]});
      setIsAdding(false);
  };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (logType === 'tank') {
        csvContent += "Datum,KM,Liter,Preis,Voll\n";
        state.fuelLog.forEach(f => csvContent += `${f.date},${f.km},${f.liters},${f.price},${f.full}\n`);
    } else {
        csvContent += "Datum,VonKM,ZuKM,Zweck,Ziel\n";
        state.tripLog.forEach(t => csvContent += `${t.date},${t.fromKm},${t.toKm},${t.purpose},${t.destination}\n`);
    }
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `camperguard_${logType}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <ViewTitle>Logbuch</ViewTitle>
        <button onClick={exportCSV} className="mb-6 p-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] text-gray-400 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <FileDown size={14} /> EXPORT
        </button>
      </div>

      <div className="flex p-1 bg-[#111] rounded border border-[#3d3d3d] mb-6">
        <button 
            onClick={() => setLogType('tank')}
            className={`flex-1 py-2 px-4 rounded text-[10px] font-black uppercase tracking-widest transition-all ${logType === 'tank' ? 'bg-orange-500 text-black' : 'text-gray-500'}`}
        >
            Betankung
        </button>
        <button 
            onClick={() => setLogType('fahrt')}
            className={`flex-1 py-2 px-4 rounded text-[10px] font-black uppercase tracking-widest transition-all ${logType === 'fahrt' ? 'bg-orange-500 text-black' : 'text-gray-500'}`}
        >
            Fahrtenbuch
        </button>
      </div>

      {logType === 'tank' && (
          <div className="space-y-4">
              <Card className="flex flex-col items-center py-8">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Historischer Real-Verbrauch</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-orange-500 font-mono tracking-tighter">{avgConsumption.toFixed(1)}</span>
                    <span className="text-xs text-gray-600 font-bold uppercase tracking-widest">L/100km</span>
                  </div>
              </Card>

              <div className="space-y-3">
                {state.fuelLog.map(entry => (
                    <Card key={entry.id} className="flex justify-between items-center border-l-2 border-l-orange-500/30">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-600 font-black font-mono">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                            <span className="font-bold text-sm tracking-tight">{entry.km.toLocaleString('de-DE')} <span className="text-[10px] opacity-40">KM</span></span>
                        </div>
                        <div className="text-right">
                            <div className="font-black text-orange-500 text-lg">{entry.liters}<span className="text-[10px] opacity-60 ml-0.5">L</span></div>
                            <div className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">{entry.price.toFixed(3)}€/L {entry.full && <span className="text-green-500 ml-1">Voll</span>}</div>
                        </div>
                    </Card>
                ))}
              </div>
          </div>
      )}

      {logType === 'fahrt' && (
          <div className="space-y-4">
              {state.tripLog.map(entry => (
                  <Card key={entry.id} className="space-y-4 relative overflow-hidden border-l-2 border-l-orange-500/30">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-600 font-black font-mono">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                            <h4 className="font-black text-orange-500 uppercase tracking-tight">{entry.destination}</h4>
                            <p className="text-[10px] text-gray-500 font-medium italic opacity-60">{entry.purpose}</p>
                        </div>
                        <div className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-[10px] font-black font-mono">
                            +{entry.toKm - entry.fromKm} KM
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">
                        <div className="flex flex-col items-center">
                            <span>Start</span>
                            <span className="text-gray-400 font-mono text-[11px]">{entry.fromKm}</span>
                        </div>
                        <ChevronRight size={14} className="opacity-20" />
                        <div className="flex flex-col items-center">
                            <span>Ziel</span>
                            <span className="text-white font-mono text-[11px]">{entry.toKm}</span>
                        </div>
                    </div>
                  </Card>
              ))}
          </div>
      )}

      <button 
        onClick={() => setIsAdding(true)}
        className="hd-button w-full py-4 mt-6"
      >
        <Plus size={16} /> Eintrag zufügen
      </button>

      <AnimatePresence>
        {isAdding && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
            >
                <div className="bg-[#2a2a2a] w-full max-w-sm rounded-lg border border-[#3d3d3d] p-6 space-y-4 shadow-2xl">
                    <h2 className="text-sm font-black text-orange-500 mb-4 uppercase tracking-[0.2em]">{logType === 'tank' ? 'Tankbeleg' : 'Fahrt-Eintrag'}</h2>
                    <div>
                        <label className="hd-label">Datum</label>
                        <input name="date" required type="date" defaultValue={new Date().toISOString().split('T')[0]} className="hd-input w-full p-2.5" />
                    </div>
                    
                    {logType === 'tank' ? (
                        <>
                            <div>
                                <label className="hd-label">KM-Stand</label>
                                <input name="km" required type="number" className="hd-input w-full p-2.5" />
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="hd-label">Liter</label>
                                    <input name="liters" required type="number" step="0.01" className="hd-input w-full p-2.5" />
                                </div>
                                <div className="flex-1">
                                    <label className="hd-label">€ / L</label>
                                    <input name="price" required type="number" step="0.001" className="hd-input w-full p-2.5" />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 pt-2">
                                <input name="full" type="checkbox" className="w-4 h-4 accent-orange-500" />
                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Vollgetankt</span>
                            </label>
                        </>
                    ) : (
                        <>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="hd-label">Start</label>
                                    <input name="from" required type="number" className="hd-input w-full p-2.5" />
                                </div>
                                <div className="flex-1">
                                    <label className="hd-label">Ziel-KM</label>
                                    <input name="to" required type="number" className="hd-input w-full p-2.5" />
                                </div>
                            </div>
                            <div>
                                <label className="hd-label">Zielort</label>
                                <input name="destination" required className="hd-input w-full p-2.5" />
                            </div>
                            <div>
                                <label className="hd-label">Zweck</label>
                                <input name="purpose" className="hd-input w-full p-2.5" />
                            </div>
                        </>
                    )}
                    
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsAdding(false)} className="hd-button-secondary flex-1">Schließen</button>
                        <button type="submit" className="hd-button flex-1" onClick={(e: any) => {
                             const form = e.target.closest('form');
                             if(form) (logType === 'tank' ? addFuel : addTrip)({ preventDefault: () => {}, currentTarget: form } as any);
                        }}>Sichern</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- TAB: REISE ---

function ReiseView({ state }: { state: AppState }) {
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  const avgConsumption = useMemo(() => {
    if (state.fuelLog.length < 2) return 11.5;
    const sorted = [...state.fuelLog].sort((a,b) => b.km - a.km);
    const totalDist = sorted[0].km - sorted[sorted.length - 1].km;
    const totalLiters = sorted.slice(0, -1).reduce((acc, curr) => acc + curr.liters, 0);
    return totalDist > 0 ? (totalLiters / totalDist) * 100 : 11.5;
  }, [state.fuelLog]);

  const range = ((state.profile.fuelCapacity || 80) / avgConsumption) * 100;

  const MapHandler = () => {
    useMapEvents({
      click(e) {
        setDestination([e.latlng.lat, e.latlng.lng]);
        setDistance(Math.floor(Math.random() * (range * 0.8)) + 50);
      },
    });
    return destination ? <Marker position={destination} /> : null;
  };

  const ResizeMap = () => {
    const map = useMap();
    useEffect(() => {
      globalLeafletMap = map;
      map.invalidateSize();
      const timer = setTimeout(() => map.invalidateSize(), 200);
      return () => {
        globalLeafletMap = null;
        clearTimeout(timer);
      };
    }, [map]);
    return null;
  };

  const isCritical = distance ? distance > range : false;

  return (
    <div className="space-y-6 h-[calc(100vh-180px)] flex flex-col">
      <ViewTitle>Reiseplaner</ViewTitle>

      <Card className="p-0 overflow-hidden relative border-[#3d3d3d] h-[500px] z-0">
          <MapContainer 
            id="map"
            center={[51.1657, 10.4515]} 
            zoom={6} 
            zoomControl={false}
            style={{ height: '100%', width: '100%', background: '#111' }}
          >
            <TileLayer 
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap'
            />
            <MapHandler />
            <ResizeMap />
          </MapContainer>
          <div className="absolute top-4 right-4 z-[400] bg-orange-500 text-black px-3 py-1.5 rounded font-black text-[10px] uppercase tracking-[0.2em] shadow-xl">
              Ziel wählen
          </div>
      </Card>

      <Card className="bg-gradient-to-b from-[#2a2a2a] to-[#252525] space-y-5">
        <div className="flex justify-between items-center">
            <div>
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none block mb-1">Max. Reichweite</span>
                <span className="text-2xl font-black font-mono text-white">{range.toFixed(0)} <span className="text-xs text-gray-600">KM</span></span>
            </div>
            {distance && (
                <div className="text-right">
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none block mb-1">Distanz</span>
                    <span className={`text-2xl font-black font-mono ${isCritical ? 'text-red-500' : 'text-green-500'}`}>{distance} <span className="text-xs opacity-50">KM</span></span>
                </div>
            )}
        </div>

        {distance && (
            <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded flex items-center justify-between transition-colors border ${isCritical ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-green-500/10 border-green-500/40 text-green-500'}`}
            >
                <div className="flex items-center gap-3">
                    {isCritical ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {isCritical ? "STOP: Tankstopp nötig!" : "LOS: Ziel erreichbar"}
                    </span>
                </div>
                <button 
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination?.[0]},${destination?.[1]}`, '_blank')}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded transition-all"
                >
                    <Navigation size={16} className="text-white" />
                </button>
            </motion.div>
        )}
      </Card>
    </div>
  );
}

// --- TAB: PROFIL ---

function ProfilView({ state, setState, demoSeed }: { state: AppState, setState: any, demoSeed: () => void }) {
  const handleChange = (path: string, val: any) => {
    const newState = {...state};
    const parts = path.split('.');
    let current = newState as any;
    for(let i=0; i<parts.length-1; i++) {
        current = current[parts[i]];
    }
    current[parts[parts.length-1]] = val;
    setState(newState);
  };

  return (
    <div className="space-y-6 pb-12">
      <ViewTitle>Vehicle Profil</ViewTitle>

      <Card className="space-y-4">
          <div>
            <label className="hd-label">Camper Name</label>
            <input 
                value={state.profile.vehicleName} onChange={e => handleChange('profile.vehicleName', e.target.value)}
                placeholder="Spitzname..." className="hd-input w-full p-4 font-bold" 
            />
          </div>
          <div>
            <label className="hd-label">Kennzeichen</label>
            <input 
                value={state.profile.plate} onChange={e => handleChange('profile.plate', e.target.value)}
                placeholder="B-CG 77" className="hd-input w-full p-4 uppercase font-mono tracking-widest" 
            />
          </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
          {[
              { label: 'H', key: 'height', unit: 'm' },
              { label: 'B', key: 'width', unit: 'm' },
              { label: 'L', key: 'length', unit: 'm' }
          ].map(d => (
              <Card key={d.key} className="flex flex-col items-center gap-1 p-3">
                  <span className="text-[9px] font-black text-gray-600 uppercase">{d.label} <span className="opacity-40 italic">({d.unit})</span></span>
                  <input 
                    type="number" step="0.01" value={(state.profile as any)[d.key]} 
                    onChange={e => handleChange(`profile.${d.key}`, parseFloat(e.target.value))} 
                    className="w-full bg-black/20 text-center font-mono font-black text-sm outline-none border-b border-[#444] py-1" 
                  />
              </Card>
          ))}
      </div>

      <Card className="space-y-5">
          <div className="flex justify-between items-center bg-black/40 p-3 rounded">
              <span className="hd-label mb-0">Leergewicht / zGG</span>
              <div className="flex items-center gap-2 font-mono font-black">
                <input type="number" value={state.profile.emptyWeight} onChange={e => handleChange('profile.emptyWeight', parseFloat(e.target.value))} className="w-16 bg-transparent text-right outline-none text-[0.7rem]" />
                <span className="text-gray-700">/</span>
                <input type="number" value={state.profile.maxWeight} onChange={e => handleChange('profile.maxWeight', parseFloat(e.target.value))} className="w-16 bg-transparent outline-none text-[0.7rem] text-orange-500" />
                <span className="text-[8px] opacity-30">KG</span>
              </div>
          </div>
          
          <div className="grid gap-3">
            <span className="hd-label">Wartungs-Termine</span>
            {state.maintenance.map((m, idx) => (
                <div key={m.id} className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-gray-500 w-20 uppercase tracking-tighter leading-tight">{m.name}</span>
                    <input 
                        type="date" value={m.date}
                        onChange={(e) => {
                            const newM = [...state.maintenance];
                            newM[idx].date = e.target.value;
                            setState({...state, maintenance: newM});
                        }}
                        className="flex-1 hd-input p-2 font-mono text-[0.7rem]" 
                    />
                </div>
            ))}
          </div>
      </Card>

      <Card className="space-y-5">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Tire Pressure Presets (bar)</span>
          <div className="grid gap-3">
            {Object.entries(state.profile.tirePressures).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{k}</span>
                    <input 
                        value={v} onChange={e => handleChange(`profile.tirePressures.${k}`, e.target.value)}
                        className="w-24 bg-black/30 border border-[#3a3a3a] rounded-xl px-3 py-2 text-right font-mono text-xs outline-none" 
                    />
                </div>
            ))}
          </div>
      </Card>

      <div className="flex flex-col gap-3 pt-6">
        <button 
            onClick={demoSeed}
            className="w-full bg-blue-500/20 text-blue-400 py-5 rounded-2xl font-black text-xs uppercase tracking-widest border border-blue-500/30 active:scale-95 transition-all"
        >
            Load Demo (Hector)
        </button>
        <button 
            onClick={() => { if(confirm("Alle Daten löschen?")) { localStorage.clear(); window.location.reload(); } }}
            className="w-full bg-red-500/10 text-red-500 py-5 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/20 active:scale-95 transition-all"
        >
            Reset All
        </button>
      </div>

      <div className="py-8 text-center">
          <p className="text-[9px] font-black text-gray-800 uppercase tracking-[0.5em] mb-1">CamperGuard Pro Engine</p>
          <p className="text-[7px] text-gray-800 font-bold uppercase tracking-widest">© 2024 Build with Integrity</p>
      </div>
    </div>
  );
}
