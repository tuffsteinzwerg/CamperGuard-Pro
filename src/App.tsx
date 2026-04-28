import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, Settings, Map as MapIcon, BookOpen, Package, Activity, 
  Plus, Trash2, ChevronRight, Save, Search, Navigation, AlertTriangle,
  FileDown, ChevronDown, ChevronUp, Printer, MapPin, Volume2, Archive, CheckCircle, Check,
  ShieldPlus, Phone, Truck, Edit2, User, Droplet, HeartPulse, Pill, Fuel
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { openDB } from 'idb';
import { INITIAL_STATE, AppState, InventoryItem, FuelEntry, TripEntry, FuelType, Currency, TireProfile, SpotEntry, FAQEntry, EmergencyGear, PharmacyItem } from './types.ts';

// Fix Leaflet icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

let globalLeafletMap: L.Map | null = null;
const DB_NAME = 'CamperGuardDB_V2';

async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    },
  });
}

const formatNumber = (num: number, decimals: number = 2) => num.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const formatWeight = (kg: number): string => {
  if (kg <= 0) return '';
  if (kg < 1) {
    const grams = Math.round(kg * 1000);
    return `${grams} g`;
  }
  return `${kg.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
};

const ViewTitle = ({ children, right }: { children: React.ReactNode, right?: React.ReactNode }) => (
  <div className="flex justify-between items-end mb-4 px-2 no-print">
      <h1 className="typo-section-title" style={{ fontSize: '14px' }}>{children}</h1>
      {right}
  </div>
);

const Card = (props: any) => {
  const { children, className, ...rest } = props;
  return (
    <div className={`card-standard rounded-lg p-4 ${className || ""}`} {...rest}>
      {children}
    </div>
  );
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'inhalt' | 'logbuch' | 'reise' | 'profil'>('status');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [orientation, setOrientation] = useState({ pitch: 0, roll: 0, heading: 0 });

  useEffect(() => {
    (async () => {
      try {
        const db = await initDB();
        const saved = await db.get('store', 'state');
        // Ensure default SOS exists if loaded from old DB
        if (saved) {
           const loadedSos = saved.sos || INITIAL_STATE.sos;
           
           // Migrate old 'name', 'address', 'iceName', 'icePhone' if they exist
           if ('name' in loadedSos) {
             const parts = (loadedSos.name || "").split(" ");
             loadedSos.firstName = parts[0] || "";
             loadedSos.lastName = parts.slice(1).join(" ") || "";
             delete loadedSos.name;
           }
           if ('address' in loadedSos) {
             loadedSos.street = loadedSos.address || "";
             delete loadedSos.address;
           }
           if ('iceName' in loadedSos) {
             loadedSos.ice1Name = loadedSos.iceName || "";
             loadedSos.ice1Phone = loadedSos.icePhone || "";
             delete loadedSos.iceName;
             delete loadedSos.icePhone;
           }
           
           // Ensure all new fields have defaults
           ['houseNumber', 'zipCode', 'city', 'country', 'ice2Name', 'ice2Phone', 'medications'].forEach(k => {
              if (loadedSos[k] === undefined) loadedSos[k] = "";
           });

           if (loadedSos.gear) {
               loadedSos.gear = loadedSos.gear.map((g: any) => {
                   const migrated = { ...g };
                   if (migrated.count === undefined) {
                       migrated.count = migrated.checked ? 1 : 0;
                   }
                   if (migrated.locations === undefined) {
                       if (typeof migrated.location === 'string') {
                           migrated.locations = migrated.location.trim() ? [migrated.location] : (migrated.checked ? [''] : []);
                       } else {
                           migrated.locations = migrated.checked ? [''] : [];
                       }
                       delete migrated.location;
                   }
                   return migrated;
               });
               
               const requiredCategories = ['Feuerlöscher', 'Feuerlöschdecke', 'Warnwesten', 'Erste-Hilfe-Kasten', 'Warndreieck'];
               requiredCategories.forEach((cat, idx) => {
                   if (!loadedSos.gear.some((g: any) => g.name === cat)) {
                       loadedSos.gear.push({
                           id: `g_new_${idx}`,
                           name: cat,
                           checked: false,
                           count: 0,
                           locations: []
                       });
                   }
               });
           }

           // Migrate tank fields
           const loadedProfile = saved.profile || INITIAL_STATE.profile;
           if ('fuelCapacity' in loadedProfile && !('freshWaterCapacity' in loadedProfile)) {
             loadedProfile.freshWaterCapacity = loadedProfile.fuelCapacity || 0;
             loadedProfile.wasteWaterCapacity = 0;
             loadedProfile.dieselCapacity = 0;
             delete loadedProfile.fuelCapacity;
           }
           if ('adBlueCapacity' in loadedProfile) {
             delete loadedProfile.adBlueCapacity;
           }
           const migratedWasteWaterLevel = saved.wasteWaterLevel ?? 0;
           const migratedDieselLevel = saved.dieselLevel ?? 50;

           // Subcategories absichern und aus vorhandenen Artikeln rekonstruieren
           const loadedSubcategories = saved.subcategories || { "Küche": [], "Wohnen": [], "Bad": [], "Garage": [], "Technik": [] };
           // Sicherstellen dass alle Kategorien als Key existieren
           ["Küche", "Wohnen", "Bad", "Garage", "Technik"].forEach(cat => {
             if (!loadedSubcategories[cat]) loadedSubcategories[cat] = [];
           });
           // Fehlende Lagerorte aus den Artikeln rekonstruieren
           if (saved.inventory && Array.isArray(saved.inventory)) {
             saved.inventory.forEach((item: any) => {
               if (item.category && item.subcategory && item.subcategory.trim() !== '') {
                 const subs = loadedSubcategories[item.category];
                 if (subs && !subs.includes(item.subcategory)) {
                   subs.push(item.subcategory);
                 }
               }
             });
           }

           setState({ 
             ...INITIAL_STATE, 
             ...saved, 
             profile: { ...INITIAL_STATE.profile, ...loadedProfile },
             wasteWaterLevel: migratedWasteWaterLevel,
             dieselLevel: migratedDieselLevel,
             subcategories: loadedSubcategories,
             exchangeRates: saved.exchangeRates || INITIAL_STATE.exchangeRates,
             sos: loadedSos 
           });
        }
      } catch (err) {
        console.error(err);
      }
      
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/EUR');
        const data = await res.json();
        if (data && data.rates) {
           setState(prev => ({...prev, exchangeRates: data.rates}));
        }
      } catch(e) {}
      
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      initDB().then(db => db.put('store', state, 'state'));
    }, 700);

    return () => clearTimeout(timer);
  }, [state, loading]);

  // Unified orientation logic
  useEffect(() => {
    let lastUpdate = 0;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      try {
        const now = Date.now();
        if (now - lastUpdate < 50) return; // Max 20Hz for Fold-Fix
        lastUpdate = now;

        let h = 0;
        if (e.alpha !== null) h = e.alpha;
        // @ts-ignore
        if (e.webkitCompassHeading !== undefined) h = e.webkitCompassHeading;
        
        setOrientation({ pitch: e.beta || 0, roll: e.gamma || 0, heading: h });
      } catch (err) {
        console.warn("DeviceOrientation handling error:", err);
      }
    };

    try {
      window.addEventListener('deviceorientation', handleOrientation);
    } catch (err) {
      console.warn("Could not attach deviceorientation", err);
    }
    
    return () => {
      try {
        window.removeEventListener('deviceorientation', handleOrientation);
      } catch (err) {}
    };
  }, []);

  const demoSeed = () => {
      setState(INITIAL_STATE);
      alert("Demo init gestartet.");
  };

  if (loading) return <div className="fixed inset-0 bg-[var(--bg-app)] z-[999]" />;

  return (
    <div className="min-h-screen pb-24 lg:max-w-none max-w-md mx-auto relative bg-[var(--bg-app)] text-white">
      
      <header className="h-[60px] px-4 bg-[var(--bg-input)] border-b-2 border-[var(--accent)] sticky top-0 z-40 flex justify-between items-center no-print overflow-hidden gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <ShieldCheck className="text-[var(--accent)]" size={20} />
          <span className="brand-title whitespace-nowrap">
            <span className="brand-big">C</span>amper<span className="brand-big">G</span>uard Pro
          </span>
        </div>
        <div className="flex items-center justify-end min-w-0 gap-3">
          <button onClick={() => setActiveTab('profil')} className="p-2 rounded bg-black/40 border border-[var(--border)] active:scale-95 transition-all text-white hover:text-[var(--accent)] flex-shrink-0">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main className="p-4 overflow-y-auto lg:max-w-6xl lg:mx-auto min-h-[80vh]">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {activeTab === 'status' && <StatusView state={state} setState={setState} orientation={orientation} />}
            {activeTab === 'inhalt' && <InhaltView state={state} setState={setState} />}
            {activeTab === 'logbuch' && <LogbuchView state={state} setState={setState} />}
            {activeTab === 'reise' && <ReiseView state={state} setState={setState} orientation={orientation} />}
            {activeTab === 'profil' && <ProfilView state={state} setState={setState} demoSeed={demoSeed} />}
          </motion.div>
        </AnimatePresence>
        <img src="/CHAMPERGUARD-PRO%20LOGO1.png" alt="CamperGuard Pro" className="hidden print-only fixed bottom-4 left-4 w-32 style-print-logo" />
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none bg-[var(--bg-input)] border-t border-[var(--border)] h-[70px] px-4 flex justify-between items-center z-40 no-print">
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
    <button onClick={onClick} className={`flex-1 flex flex-col items-center gap-1 transition-all ${active ? 'text-[var(--accent)]' : 'text-white/60 hover:text-white'}`}>
      <motion.div animate={active ? { scale: 1.1 } : { scale: 1 }}>{icon}</motion.div>
      <span className="typo-label" style={{ fontSize: '9px', color: 'inherit' }}>{label}</span>
      {active && <motion.div layoutId="nav-indicator" className="w-4 h-0.5 bg-[var(--accent)] mt-1" />}
    </button>
  );
}
// --- SUBVIEWS ---
function StatusView({ state, setState, orientation }: any) {
  const [showSos, setShowSos] = useState(false);
  const [sosTab, setSosTab] = useState<'hilfe'|'id'|'inhalt'>('hilfe');
  const [isEditingId, setIsEditingId] = useState(false);
  const [gpsAlt, setGpsAlt] = useState<number|null>(null);
  const [gpsCoords, setGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'offline'|'loading'|'active'>('offline');
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");

  const pitchNormalized = Math.max(-20, Math.min(20, orientation.pitch));
  const rollNormalized = Math.max(-20, Math.min(20, orientation.roll));
  const heading = orientation.heading;
  
  const waterWeightImpact = (state.waterLevel / 100) * (state.profile.freshWaterCapacity || 0) * 1.0;
  const wasteWaterWeight = (state.wasteWaterLevel / 100) * (state.profile.wasteWaterCapacity || 0) * 1.0;
  const dieselWeight = (state.dieselLevel / 100) * (state.profile.dieselCapacity || 0) * 0.84;
  const inventoryWeight = (state.inventory || []).reduce((acc: number, item: any) => {
    if (item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) {
      const unit = (item.weightUnit || 'kg').toLowerCase();
      if (unit === 'g' || unit === 'gr') return acc + (item.weight * (item.quantity || 0)) / 1000;
      return acc + (item.weight * (item.quantity || 0));
    }
    return acc;
  }, 0);
  const totalWeight = (state.profile.emptyWeight || 0) + waterWeightImpact + wasteWaterWeight + dieselWeight + inventoryWeight;
  const remainingWeight = (state.profile.maxWeight || 0) - totalWeight;

  useEffect(() => {
     let watchId: number | undefined;
     if (state.sos.gpsEnabled !== false) {
       setGpsStatus('loading');
       try {
         watchId = navigator.geolocation.watchPosition(
            p => {
               setGpsAlt(p.coords.altitude);
               setGpsCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
               setGpsStatus('active');
            },
            e => {
               console.warn(e);
               setGpsStatus('offline');
               setGpsCoords(null);
               setGpsAlt(null);
            },
            { enableHighAccuracy: true }
         );
       } catch (err) {
         console.warn("Geolocation start error:", err);
         setGpsStatus('offline');
       }
     } else {
       setGpsStatus('offline');
       setGpsCoords(null);
       setGpsAlt(null);
     }
     return () => {
       if (watchId !== undefined) {
         try { navigator.geolocation.clearWatch(watchId); } catch(e){}
       }
     };
  }, [state.sos.gpsEnabled]);

  const updateSos = (field: string, val: any) => setState({...state, sos: {...state.sos, [field]: val}});

  const overLbs = remainingWeight < 0 ? Math.abs(remainingWeight) : 0;
  const warnings: {type: 'danger' | 'warn', text: string}[] = [];
  if (overLbs > 0) {
      warnings.push({ type: 'danger', text: `Fahrzeug überladen! ${formatNumber(overLbs, 0)} kg über ZGG` });
  }
  const nowMs = new Date().getTime();
  (state.maintenance || []).forEach((m: any) => {
      if (!m.date) return;
      const dateMs = new Date(m.date).getTime();
      const diffDays = (dateMs - nowMs) / (1000 * 3600 * 24);
      if (diffDays < 0) {
          warnings.push({ type: 'danger', text: `${m.name} überfällig seit ${new Date(m.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` });
      } else if (diffDays <= 30) {
          warnings.push({ type: 'warn', text: `${m.name} fällig am ${new Date(m.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` });
      }
  });

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-24 px-2 pt-4">
      {/* Element 1: SOS-Button */}
      {!showSos && (
      <div className="fixed top-[11px] left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none px-4 z-[60] pointer-events-none flex justify-end">
          <div className="pointer-events-auto mr-[46px]">
              <button onClick={() => setShowSos(true)} className="bg-[var(--accent)] text-black px-3 py-1.5 rounded typo-label flex items-center gap-1.5 animate-pulse border border-[var(--accent-dark)] uppercase tracking-widest shadow-lg shadow-[var(--accent)]/20">
                  <ShieldPlus size={16} strokeWidth={3} />
                  SOS
              </button>
          </div>
      </div>
      )}

      {/* Element 3: Gewichts-Hero-Anzeige */}
      <div className="card-standard">
          <div className="typo-section-title mb-4">GESAMTGEWICHT</div>
          
          <div className="flex items-baseline gap-2 mb-4">
              <span className="typo-value-hero">{formatNumber(totalWeight, 0)}</span>
              <span className="typo-value-small">kg / {formatNumber(state.profile.maxWeight || 3500, 0)} kg</span>
          </div>
          
          <div className="progress-bar-track mb-3">
              <div 
                 className="progress-bar-fill" 
                 style={{ 
                     width: `${Math.min(100, (totalWeight / (state.profile.maxWeight || 3500)) * 100)}%`,
                     backgroundColor: totalWeight > (state.profile.maxWeight || 3500) ? 'var(--status-danger)' : ((totalWeight / (state.profile.maxWeight || 3500)) > 0.9 ? 'var(--status-warn)' : 'var(--status-ok)')
                 }} 
              />
          </div>
          
          <div className="typo-body" style={{ color: remainingWeight >= 0 ? 'var(--status-ok)' : 'var(--status-danger)' }}>
              {remainingWeight >= 0 ? `✓ Im sicheren Bereich — noch ${formatNumber(remainingWeight, 0)} kg frei` : `✕ Überladen! ${formatNumber(Math.abs(remainingWeight), 0)} kg über dem zulässigen Gesamtgewicht`}
          </div>
      </div>

      {/* Element 5: Gewichtsaufschlüsselung */}
      <div className="card-standard">
          <div className="typo-section-title mb-4">GEWICHTSAUFSCHLÜSSELUNG</div>
          <div className="space-y-2">
              <div className="flex justify-between items-center">
                  <span className="typo-body-dim">Leergewicht</span>
                  <span className="typo-value-small">{formatNumber(state.profile.emptyWeight || 0, 0)} kg</span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="typo-body-dim">Frischwasser</span>
                  <span className="typo-value-small">+ {formatWeight(waterWeightImpact)}</span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="typo-body-dim">Abwasser</span>
                  <span className="typo-value-small">+ {formatWeight(wasteWaterWeight)}</span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="typo-body-dim">Diesel</span>
                  <span className="typo-value-small">+ {formatWeight(dieselWeight)}</span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="typo-body-dim">Inventar</span>
                  <span className="typo-value-small">+ {formatWeight(inventoryWeight)}</span>
              </div>
          </div>
          <hr className="divider" />
          <div className="flex justify-between items-end">
              <span className="typo-body-dim">Gesamtgewicht</span>
              <div className="flex items-baseline gap-1">
                  <span className="typo-value-large">{formatNumber(totalWeight, 0)}</span>
                  <span className="typo-value-small">/ {formatNumber(state.profile.maxWeight || 3500, 0)} kg</span>
              </div>
          </div>
      </div>

      {/* Element 2: Warnbereich */}
      {warnings.length > 0 && (
          <div className="space-y-3">
              {warnings.map((w, idx) => (
                  <div key={idx} className="card-standard flex items-center gap-3" style={{ borderLeft: `3px solid var(--status-${w.type})`, padding: '12px 16px' }}>
                      <AlertTriangle size={18} style={{ color: `var(--status-${w.type})` }} />
                      <span className="typo-body">{w.text}</span>
                  </div>
              ))}
          </div>
      )}

      {/* Element 4: Tank-Stände (Hidden) */}
      {false && (
      <div className="card-standard">
          <div className="typo-section-title mb-4">TANKSTÄNDE</div>
          
          <div className="flex items-center gap-4">
              <div className="icon-circle"><Droplet className="text-blue-400" /></div>
              <div className="flex-1">
                  <div className="flex justify-between items-end mb-1">
                      <div>
                         <div className="typo-body">Frischwasser</div>
                         <div className="typo-body-dim">{formatNumber((state.waterLevel / 100) * (state.profile.freshWaterCapacity || 0), 0)} L von {state.profile.freshWaterCapacity || 0} L</div>
                      </div>
                      <div className="text-right">
                         <div className="typo-value-normal">{state.waterLevel}%</div>
                         <div className="typo-value-small">= {formatWeight(waterWeightImpact)}</div>
                      </div>
                  </div>
                  <input type="range" min="0" max="100" step="25" value={state.waterLevel} onChange={(e) => setState({...state, waterLevel: parseInt(e.target.value)})} className="w-full h-2 bg-[var(--bg-input)] rounded-full appearance-none cursor-pointer accent-[var(--accent)]" />
              </div>
          </div>
          
          <hr className="divider" />
          
          <div className="flex items-center gap-4">
              <div className="icon-circle"><Droplet className="text-orange-400" /></div>
              <div className="flex-1">
                  <div className="flex justify-between items-end mb-1">
                      <div>
                         <div className="typo-body">Abwasser</div>
                         <div className="typo-body-dim">{formatNumber((state.wasteWaterLevel / 100) * (state.profile.wasteWaterCapacity || 0), 0)} L von {state.profile.wasteWaterCapacity || 0} L</div>
                      </div>
                      <div className="text-right">
                         <div className="typo-value-normal">{state.wasteWaterLevel}%</div>
                         <div className="typo-value-small">= {formatWeight(wasteWaterWeight)}</div>
                      </div>
                  </div>
                  <input type="range" min="0" max="100" step="25" value={state.wasteWaterLevel} onChange={(e) => setState({...state, wasteWaterLevel: parseInt(e.target.value)})} className="w-full h-2 bg-[var(--bg-input)] rounded-full appearance-none cursor-pointer accent-[var(--accent)]" />
              </div>
          </div>
          
          <hr className="divider" />
          
          <div className="flex items-center gap-4">
              <div className="icon-circle"><Fuel className="text-yellow-400" /></div>
              <div className="flex-1">
                  <div className="flex justify-between items-end mb-1">
                      <div>
                         <div className="typo-body">Diesel</div>
                         <div className="typo-body-dim">{formatNumber((state.dieselLevel / 100) * (state.profile.dieselCapacity || 0), 0)} L von {state.profile.dieselCapacity || 0} L</div>
                      </div>
                      <div className="text-right">
                         <div className="typo-value-normal">{state.dieselLevel}%</div>
                         <div className="typo-value-small">= {formatWeight(dieselWeight)}</div>
                      </div>
                  </div>
                  <input type="range" min="0" max="100" step="10" value={state.dieselLevel} onChange={(e) => setState({...state, dieselLevel: parseInt(e.target.value)})} className="w-full h-2 bg-[var(--bg-input)] rounded-full appearance-none cursor-pointer accent-[var(--accent)]" />
              </div>
          </div>
      </div>
      )}

      {/* Element 6: Wartungstermine */}
      <div className="card-standard">
          <div className="typo-section-title mb-4">WARTUNG</div>
          <div className="grid grid-cols-2 gap-3">
              {(state.maintenance || []).map((item: any) => {
                  const date = item.date ? new Date(item.date) : null;
                  const diffInDays = date ? (date.getTime() - new Date().getTime()) / (1000 * 3600 * 24) : 999;
                  const borderColor = diffInDays < 0 ? 'var(--status-danger)' : diffInDays < 60 ? 'var(--status-warn)' : 'var(--border)';
                  return (
                      <div key={item.id} className="card-standard flex flex-col items-center justify-center" style={{ borderBottom: `3px solid ${borderColor}`, padding: '16px' }}>
                          <span className="typo-label mb-1 text-center">{item.name}</span>
                          <span className="typo-value-large text-center">{item.date ? new Date(item.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}</span>
                      </div>
                  );
              })}
          </div>
      </div>

      {/* Element 7: Abfahrt-Checkliste */}
      <div className="card-standard">
          <div 
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setIsChecklistOpen(!isChecklistOpen)}
          >
              <div className="typo-section-title">ABFAHRT-CHECKLISTE</div>
              <span className={`transition-transform duration-200 text-[var(--accent)] ${isChecklistOpen ? 'rotate-180' : ''}`}>
                  <ChevronDown size={16} />
              </span>
          </div>
          {isChecklistOpen && (
              <div className="space-y-0 mt-4 pt-2 border-t border-[var(--border)]">
                  {(state.checklist || []).map((item: any, index: number) => {
                      return (
                          <React.Fragment key={item.id}>
                              {index > 0 && <hr className="divider" />}
                              <div className="py-2 flex items-center justify-between group hover:bg-black/20 transition-colors -mx-2 px-2 rounded">
                                  {editingChecklistItemId === item.id ? (
                                      <div className="flex items-center gap-2 flex-1 w-full">
                                          <input
                                              type="text"
                                              value={editingChecklistText}
                                              onChange={(e) => setEditingChecklistText(e.target.value)}
                                              className="input-standard flex-1 py-1"
                                              onKeyDown={(e) => {
                                                  if (e.key === 'Enter' && editingChecklistText.trim() !== '') {
                                                      const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, label: editingChecklistText.trim()} : c);
                                                      setState({...state, checklist: nc});
                                                      setEditingChecklistItemId(null);
                                                  } else if (e.key === 'Escape') {
                                                      setEditingChecklistItemId(null);
                                                  }
                                              }}
                                              autoFocus
                                          />
                                          <button 
                                              onClick={() => {
                                                  if(editingChecklistText.trim() !== '') {
                                                      const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, label: editingChecklistText.trim()} : c);
                                                      setState({...state, checklist: nc});
                                                      setEditingChecklistItemId(null);
                                                  }
                                              }}
                                              className="text-white hover:text-[var(--accent)] transition-colors p-2"
                                          >
                                              <Check size={16} />
                                          </button>
                                          <button onClick={() => setEditingChecklistItemId(null)} className="text-white hover:text-white/50 transition-colors p-2 font-bold normal-case leading-none">X</button>
                                      </div>
                                  ) : (
                                      <>
                                          <div onClick={() => {
                                                  const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, checked: !c.checked} : c);
                                                  setState({...state, checklist: nc});
                                              }}
                                              className="flex items-center gap-3 cursor-pointer flex-1 py-1"
                                          >
                                              <div className={`w-[18px] h-[18px] border-2 flex-shrink-0 border-[var(--accent)] rounded-sm relative flex items-center justify-center transition-colors ${item.checked ? 'bg-[var(--accent)]' : 'bg-transparent'}`}>
                                                   {item.checked && <Check size={14} className="text-black" />}
                                              </div>
                                              <span className={`typo-body ${item.checked ? 'opacity-40 line-through' : ''}`}>{item.label}</span>
                                          </div>
                                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={(e) => { e.stopPropagation(); setEditingChecklistText(item.label); setEditingChecklistItemId(item.id); }} className="text-white/30 hover:text-[var(--accent)] transition-colors p-2"><Edit2 size={14}/></button>
                                              <button onClick={(e) => { e.stopPropagation(); setState({...state, checklist: state.checklist.filter((c:any) => c.id !== item.id)}); }} className="text-white/30 hover:text-red-500 transition-colors p-2"><Trash2 size={14}/></button>
                                          </div>
                                      </>
                                  )}
                              </div>
                          </React.Fragment>
                      );
                  })}
                  <hr className="divider" />
                  <div className="py-3 flex items-center gap-2">
                      <input 
                          type="text" 
                          placeholder="Neuer Eintrag..." 
                          value={newChecklistItem} 
                          onChange={(e) => setNewChecklistItem(e.target.value)} 
                          className="input-standard flex-1"
                          onKeyDown={(e) => {
                              if (e.key === 'Enter' && newChecklistItem.trim() !== '') {
                                  const n = { id: Date.now().toString(), label: newChecklistItem.trim(), checked: false };
                                  setState({...state, checklist: [...(state.checklist || []), n]});
                                  setNewChecklistItem("");
                              }
                          }}
                      />
                      <button 
                          onClick={() => {
                              if (newChecklistItem.trim() !== '') {
                                  const n = { id: Date.now().toString(), label: newChecklistItem.trim(), checked: false };
                                  setState({...state, checklist: [...(state.checklist || []), n]});
                                  setNewChecklistItem("");
                              }
                          }} 
                          className="btn-secondary px-3 py-2 typo-label normal-case whitespace-nowrap h-[42px]"
                      >
                          <Plus size={16} />
                      </button>
                  </div>
              </div>
          )}
      </div>

      <AnimatePresence>
          {showSos && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 overflow-y-auto">
                 <div className="flex justify-between items-center mb-4 pt-4 border-b border-[var(--border)] pb-4">
                     <h2 className="typo-section-title flex items-center gap-2" style={{ fontSize: '18px' }}><ShieldPlus size={24}/> SAFETY HUB</h2>
                     <button onClick={() => setShowSos(false)} className="btn-secondary px-3 py-1">X</button>
                 </div>

                 <div className="sticky top-0 z-[100] flex p-1.5 bg-[var(--bg-app)] rounded-md border border-[var(--border)] mb-8 shadow-xl shadow-black/80">
                    {['hilfe', 'id', 'inhalt'].map(t => (
                        <button key={t} onClick={() => setSosTab(t as any)} className={`flex-1 py-3 px-3 rounded typo-label transition-all ${sosTab === t ? 'card-standard text-[var(--accent)] border border-[var(--accent)]/50 shadow-md' : 'text-white hover:bg-black/20'}`}>
                            {t}
                        </button>
                    ))}
                 </div>

                 {sosTab === 'hilfe' && (
                     <div className="space-y-4 flex-1 relative z-0">
                         <div className="card-standard border-[var(--accent)]">
                             <div className="flex justify-between items-start mb-2">
                                 <h3 className="typo-label">Deine Position</h3>
                                 <label className="flex items-center gap-2 typo-label cursor-pointer">
                                     <input type="checkbox" checked={state.sos.gpsEnabled !== false} onChange={e => updateSos('gpsEnabled', e.target.checked)} className="accent-[var(--accent)]" />
                                     GPS
                                 </label>
                             </div>
                             <div className={`font-mono pt-1 ${gpsStatus === 'active' ? 'typo-value-normal tracking-normal' : 'typo-value-large tracking-tighter'}`} style={{ color: 'var(--accent)' }}>
                                 {gpsStatus === 'loading' && <span className="typo-label text-white/60 animate-pulse uppercase">Position wird ermittelt...</span>}
                                 {gpsStatus === 'offline' && <span>GPS OFFLINE</span>}
                                 {gpsStatus === 'active' && gpsCoords && (
                                     <div className="flex flex-col gap-0.5">
                                         <div>Breite: {gpsCoords.lat.toFixed(6)}</div>
                                         <div>Länge: {gpsCoords.lng.toFixed(6)}</div>
                                     </div>
                                 )}
                             </div>
                             {gpsStatus === 'active' && gpsAlt !== null && <div className="typo-tiny mt-1 opacity-80">Höhe: {Math.round(gpsAlt)}m</div>}
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                             <a href="tel:112" className="bg-red-600 text-white p-6 rounded flex flex-col items-center justify-center font-black text-2xl border border-red-400 active:scale-95 transition-transform"><Phone size={32} className="mb-2"/> 112 <span className="typo-tiny mt-1">Europa</span></a>
                             <a href={`tel:${state.sos.ice1Phone}`} className="bg-orange-600 text-white p-4 rounded flex flex-col items-center justify-center font-black text-lg border border-orange-400 active:scale-95 transition-transform"><Phone size={24} className="mb-2"/> ICE Kontakt <span className="text-[9px] font-bold mt-1 uppercase text-center">{state.sos.ice1Name || 'Nicht konfiguriert'}</span></a>
                         </div>

                         <a href="https://www.google.com/maps/search/Apotheke" target="_blank" rel="noreferrer" className="block w-full text-center py-4 btn-secondary mt-4">Nächste Apotheke Suchen (Map)</a>
                     </div>
                 )}

                 {sosTab === 'id' && (
  <div className="space-y-5 mt-4 relative z-10">

    <div>
      <h4 className="typo-section-title mb-2">
        Notfall-Kontakte (ICE)
      </h4>

      <div className="card-standard rounded-lg overflow-hidden">
        <div className="flex items-center gap-4 p-4 border-b border-[var(--border)]">
          <div className="icon-circle shrink-0">
            <User className="w-6 h-6 text-[var(--accent)]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="typo-label">ICE 1</div>
            <input
              value={state.sos.ice1Name}
              onChange={e => updateSos('ice1Name', e.target.value)}
              className="w-full bg-transparent border-none outline-none typo-value-large p-0"
            />
          </div>

          <div className="h-10 w-px bg-[var(--border)] mx-1" />

          <Phone className="w-5 h-5 text-[var(--accent)] shrink-0" />
          <input
            type="tel"
            value={state.sos.ice1Phone}
            onChange={e => updateSos('ice1Phone', e.target.value)}
            className="w-28 bg-transparent border-none outline-none typo-value-large p-0"
          />
        </div>

        <div className="flex items-center gap-4 p-4">
          <div className="icon-circle shrink-0">
            <User className="w-6 h-6 text-[var(--accent)]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="typo-label">ICE 2</div>
            <input
              value={state.sos.ice2Name}
              onChange={e => updateSos('ice2Name', e.target.value)}
              className="w-full bg-transparent border-none outline-none typo-value-large p-0"
            />
          </div>

          <div className="h-10 w-px bg-[var(--border)] mx-1" />

          <Phone className="w-5 h-5 text-[var(--accent)] shrink-0" />
          <input
            type="tel"
            value={state.sos.ice2Phone}
            onChange={e => updateSos('ice2Phone', e.target.value)}
            className="w-28 bg-transparent border-none outline-none typo-value-large p-0"
          />
        </div>
      </div>
    </div>

    <div>
      <h4 className="typo-section-title mb-2">
        Blutgruppe
      </h4>

      <div className="card-standard rounded-lg p-4 flex items-center gap-4">
        <div className="icon-circle shrink-0">
          <Droplet className="w-6 h-6 text-[var(--accent)]" />
        </div>

        <select
          value={state.sos.bloodGroup}
          onChange={e => updateSos('bloodGroup', e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-[var(--accent)] text-3xl font-black appearance-none"
        >
          <option value="">Unbekannt</option>
          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'].map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <ChevronDown className="w-6 h-6 text-white/70 shrink-0" />
      </div>
    </div>

    <div>
      <h4 className="typo-section-title mb-2">
        Vorerkrankungen / Allergien
      </h4>

      <div className="card-standard flex flex-col md:flex-row gap-4">
        <div className="icon-circle shrink-0">
          <HeartPulse className="w-5 h-5 text-[var(--accent)]" />
        </div>

        <textarea
          value={state.sos.medicalConditions}
          onChange={e => updateSos('medicalConditions', e.target.value)}
          className="input-standard flex-1 min-h-[90px]"
        />
      </div>
    </div>

    <div>
      <h4 className="typo-section-title mb-2">
        Medikamente
      </h4>

      <div className="card-standard flex flex-col md:flex-row gap-4">
        <div className="icon-circle shrink-0">
          <Pill className="w-5 h-5 text-[var(--accent)]" />
        </div>

        <textarea
          value={state.sos.medications}
          onChange={e => updateSos('medications', e.target.value)}
          placeholder="Regelmäßige Medikationen hier eintragen..."
          className="input-standard flex-1 min-h-[70px]"
        />
      </div>
    </div>

    <div>
      <h4 className="typo-section-title mb-2">
        Adresse
      </h4>

      <div className="card-standard flex flex-col md:flex-row gap-4">
        <div className="icon-circle shrink-0">
          <MapPin className="w-5 h-5 text-[var(--accent)]" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={state.sos.firstName} onChange={e => updateSos('firstName', e.target.value)} className="input-standard w-full" placeholder="Vorname" />
            <input value={state.sos.lastName} onChange={e => updateSos('lastName', e.target.value)} className="input-standard w-full" placeholder="Nachname" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input value={state.sos.street} onChange={e => updateSos('street', e.target.value)} className="input-standard w-full col-span-2" placeholder="Straße" />
            <input value={state.sos.houseNumber} onChange={e => updateSos('houseNumber', e.target.value)} className="input-standard w-full" placeholder="Nr." />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input value={state.sos.zipCode} onChange={e => updateSos('zipCode', e.target.value)} className="input-standard w-full" placeholder="PLZ" />
            <input value={state.sos.city} onChange={e => updateSos('city', e.target.value)} className="input-standard w-full col-span-2" placeholder="Stadt" />
          </div>

          <input value={state.sos.country} onChange={e => updateSos('country', e.target.value)} className="input-standard w-full" placeholder="Land" />
        </div>
      </div>
    </div>

  </div>
)}

                 {sosTab === 'inhalt' && (
                     <div className="space-y-6">
                         <div>
                             <h3 className="typo-section-title pb-2 mb-3 border-b border-[var(--border)]">Notfall-Ausrüstung</h3>
                             {state.sos.gear.map((g: any, i: number) => (
                                 <div key={g.id} className="flex flex-col card-standard mb-3">
                                     <div className="flex justify-between items-center">
                                         <span className="typo-card-title">{g.name}</span>
                                         <button onClick={() => { 
                                             const newChecked = !g.checked;
                                             let newCount = g.count;
                                             let newLocations = g.locations;
                                             if (!newChecked) {
                                                 newCount = 0;
                                             } else if (newCount === 0 || !newCount) {
                                                 newCount = 1;
                                                 if (!newLocations || newLocations.length === 0) newLocations = [''];
                                             }
                                             updateSos('gear', state.sos.gear.map((gx: any, idx: number) => idx === i ? { ...gx, checked: newChecked, count: newCount, locations: newLocations } : gx)); 
                                         }} className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center ${g.checked ? 'bg-red-500 border-red-500' : 'border-[var(--border)]'}`}>{g.checked && <Check size={14} className="text-white"/>}</button>
                                     </div>
                                     {g.checked && (
                                        <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                                            <div className="flex justify-between items-center">
                                                <span className="typo-label">Anzahl</span>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => updateSos('gear', state.sos.gear.map((gx: any, idx: number) => idx === i ? { ...gx, count: Math.max(1, (gx.count||0)-1) } : gx))} className="btn-secondary px-2 py-1">-</button>
                                                    <input type="number" min="1" value={g.count} onChange={e => updateSos('gear', state.sos.gear.map((gx: any, idx: number) => idx === i ? { ...gx, count: parseInt(e.target.value) || 1 } : gx))} className="input-standard text-center w-16" />
                                                    <button onClick={() => updateSos('gear', state.sos.gear.map((gx: any, idx: number) => idx === i ? { ...gx, count: (gx.count||0)+1 } : gx))} className="btn-secondary px-2 py-1">+</button>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-end mb-2 border-b border-[var(--border)] pb-1">
                                                    <span className="typo-section-title text-[var(--accent)]">Lagerorte</span>
                                                    <button onClick={() => updateSos('gear', state.sos.gear.map((gx: any, idx: number) => idx === i ? { ...gx, locations: [...(gx.locations || []), ''] } : gx))} className="btn-secondary typo-label px-2 py-1! normal-case">+ ORT HINZUFÜGEN</button>
                                                </div>
                                                <div className="space-y-2">
                                                    {(g.locations || []).map((loc: string, locIdx: number) => (
                                                        <div key={locIdx} className="flex items-center gap-2">
                                                            <input value={loc} onChange={e => updateSos('gear', state.sos.gear.map((gx: any, idx: number) => idx === i ? { ...gx, locations: (gx.locations || []).map((l: string, lIdx: number) => lIdx === locIdx ? e.target.value : l) } : gx))} placeholder={`Lagerort ${locIdx + 1} (z.B. Beifahrertür)`} className="input-standard w-full" />
                                                            <button onClick={() => updateSos('gear', state.sos.gear.map((gx: any, idx: number) => idx === i ? { ...gx, locations: (gx.locations || []).filter((_: any, lIdx: number) => lIdx !== locIdx) } : gx))} className="text-red-500/50 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                     )}
                                 </div>
                             ))}
                         </div>
                         <div>
                             <h3 className="typo-section-title border-b border-[var(--border)] pb-2 mb-3 flex justify-between items-center">
                                 Apotheke 
                                 <button onClick={() => updateSos('pharmacy', [...state.sos.pharmacy, {id: Date.now().toString(), name:'Neu', purpose:'', expiry:'', location:'', quantity:1, unit:'stk'}])} className="btn-secondary typo-label px-2 py-1! normal-case">+ MEDIKAMENT</button>
                             </h3>
                             {state.sos.pharmacy.map((p: any, i: number) => (
                                 <div key={p.id} className="card-standard mb-2 relative">
                                     <button onClick={() => updateSos('pharmacy', state.sos.pharmacy.filter((_: any, idx: number) => idx !== i))} className="absolute top-2 right-2 text-[var(--status-danger)]/50 hover:text-[var(--status-danger)] z-10"><Trash2 size={14}/></button>
                                     <div className="grid grid-cols-2 gap-2 mb-2 pr-6">
                                         <input value={p.name} onChange={e => updateSos('pharmacy', state.sos.pharmacy.map((px: any, idx: number) => idx === i ? { ...px, name: e.target.value } : px))} placeholder="Name" className="input-standard" />
                                         <input value={p.purpose} onChange={e => updateSos('pharmacy', state.sos.pharmacy.map((px: any, idx: number) => idx === i ? { ...px, purpose: e.target.value } : px))} placeholder="Zweck" className="input-standard" />
                                     </div>
                                     <div className="grid grid-cols-2 gap-2 mb-2">
                                         <div className="flex gap-1 items-center">
                                             <span className="typo-label">EXP:</span>
                                             <input type="month" value={p.expiry} onChange={e => updateSos('pharmacy', state.sos.pharmacy.map((px: any, idx: number) => idx === i ? { ...px, expiry: e.target.value } : px))} className="input-standard flex-1" />
                                         </div>
                                         <input value={p.location} onChange={e => updateSos('pharmacy', state.sos.pharmacy.map((px: any, idx: number) => idx === i ? { ...px, location: e.target.value } : px))} placeholder="Ort" className="input-standard" />
                                     </div>
                                     <div className="flex justify-between items-center mt-3 pt-2 border-t border-[var(--border)]">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => updateSos('pharmacy', state.sos.pharmacy.map((px: any, idx: number) => idx === i ? { ...px, quantity: Math.max(0, (px.quantity||0)-1) } : px))} className="btn-secondary px-2 py-1">-</button>
                                            <span className="typo-value-normal w-6 text-center flex items-center justify-center">{p.quantity}</span>
                                            <button onClick={() => updateSos('pharmacy', state.sos.pharmacy.map((px: any, idx: number) => idx === i ? { ...px, quantity: (px.quantity||0)+1 } : px))} className="btn-secondary px-2 py-1">+</button>
                                        </div>
                                        <select value={p.unit} onChange={e => updateSos('pharmacy', state.sos.pharmacy.map((px: any, idx: number) => idx === i ? { ...px, unit: e.target.value } : px))} className="input-standard py-1">
                                            <option value="stk">Stk</option>
                                            <option value="ml">ml</option>
                                        </select>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}
              </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
// --- TAB: INHALT ---

function InhaltView({ state, setState }: any) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Küche");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [editingSub, setEditingSub] = useState<{old: string, new: string} | null>(null);
  const [deletingSub, setDeletingSub] = useState<string | null>(null);
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({ name: '', quantity: '1', unit: 'stk', weight: '', weightUnit: 'kg', subcategory: '' });
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  const formatUnit = (u?: string) => {
    if (!u) return '';
    const lower = u.toLowerCase();
    if (lower === 'g' || lower === 'gr') return 'g';
    if (lower === 'stk' || lower === 'stück') return 'stk';
    if (lower === 'kg') return 'kg';
    if (lower === 'l' || lower === 'liter') return 'l';
    return u;
  };

  const categories = ["Küche", "Wohnen", "Bad", "Garage", "Technik"];

  const searchedItems = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return state.inventory.filter((item: any) => 
        (item.name && item.name.toLowerCase().includes(term)) || 
        (item.subcategory && item.subcategory.toLowerCase().includes(term)) ||
        (item.category && item.category.toLowerCase().includes(term))
    );
  }, [state.inventory, searchTerm]);

  const filteredItems = state.inventory.filter((item: any) => 
    item.category === activeCategory
  );

  const groupedBySub = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const uniqueSubs = Array.from(new Set(state.subcategories[activeCategory] || []));
    uniqueSubs.forEach((sub:any) => groups[sub as string] = []);
    
    filteredItems.forEach((item: any) => {
        if (groups[item.subcategory]) {
            groups[item.subcategory].push(item);
        }
    });
    return groups;
  }, [filteredItems, activeCategory, state.subcategories]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-4 px-2 no-print">
          <h1 className="typo-section-title">INHALT</h1>
          <button onClick={() => window.print()} className="btn-secondary p-2"><Printer size={16}/></button>
      </div>

      <div className="relative no-print mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
        <input type="text" placeholder="Bestand durchsuchen..." className="input-standard w-full !pl-[34px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="no-print pb-4">
          <select 
              value={activeCategory} 
              onChange={e => setActiveCategory(e.target.value)} 
              className="input-standard w-full"
          >
              {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-[var(--bg-card)] text-white">{cat}</option>
              ))}
          </select>
      </div>

      {searchTerm ? (
          <div className="space-y-4 print-only print-table">
              <div className="mb-4">
                  <div className="flex justify-between items-baseline border-b border-[var(--border)] pb-1 mb-2">
                      <h3 className="typo-body text-white/70">Suchergebnisse ({searchedItems.length})</h3>
                  </div>
                  {searchedItems.length === 0 ? (
                      <div className="text-center py-10 typo-body-dim text-[var(--text-muted)]">Keine Ergebnisse gefunden</div>
                  ) : (
                      <div className="w-full mb-4 space-y-3">
                          {searchedItems.map((item:any) => (
                              <div key={item.id} className={`card-standard flex items-center justify-between ${item.quantity === 0 ? '!border-[var(--status-danger)]' : ''}`}>
                                  <div className="flex-1">
                                      <div className="typo-card-title">{item.name}</div>
                                      {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) && (
                                          <div className="typo-body-dim !mb-0">
                                              {item.weight} {formatUnit(item.weightUnit)}
                                          </div>
                                      )}
                                      <div className="typo-body-dim text-[var(--text-tertiary)]">
                                          {item.category} / {item.subcategory}
                                      </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 mx-4">
                                      <span className={`typo-value-normal ${item.quantity === 0 ? 'text-[var(--status-danger)]' : ''}`}>{item.quantity}</span>
                                      <span className="typo-value-small ml-1">{formatUnit(item.unit)}</span>
                                  </div>
                                  <div className="flex justify-end items-center gap-3 no-print flex-shrink-0 w-16">
                                      <button onClick={() => { setActiveCategory(item.category); setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory }); setEditingItem(item); }} className="text-white hover:text-[var(--accent)]"><Edit2 size={14} /></button>
                                      <button onClick={() => setDeletingItem(item)} className="text-white hover:text-red-500"><Trash2 size={14} /></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      ) : (
          <div className="space-y-4 print-only print-table">
          {Array.from(new Set(state.subcategories[activeCategory] || [])).map((sub:any) => (
              <div key={sub} className="mb-4">
                  <div 
                      className="card-standard flex justify-between items-center cursor-pointer select-none"
                      onClick={() => setActiveAccordion(activeAccordion === sub ? null : sub)}
                  >
                      <div className="flex items-center gap-3">
                          <h3 className="typo-section-title" style={{ color: 'var(--accent)', marginBottom: 0 }}>{sub}</h3>
                          <span className="typo-value-small">
                              {(() => {
                                  const totalKg = (groupedBySub[sub] || []).reduce((acc: number, item: any) => {
                                      if (item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) {
                                          const unit = (item.weightUnit || 'kg').toLowerCase();
                                          if (unit === 'gr' || unit === 'g') {
                                              return acc + (item.weight * (item.quantity || 0)) / 1000;
                                          }
                                          return acc + (item.weight * (item.quantity || 0));
                                      }
                                      return acc;
                                  }, 0);
                                  return formatWeight(totalKg);
                              })()}
                          </span>
                      </div>
                      <div className="flex items-center gap-2 no-print" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditingSub({old: sub, new: sub})} className="text-white hover:text-[var(--accent)]"><Edit2 size={14} /></button>
                          <button onClick={() => setDeletingSub(sub)} className="text-white hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                  </div>
                  {activeAccordion === sub && (
                      <div className="w-full mb-4 space-y-3 mt-3">
                          {(groupedBySub[sub] || []).map((item:any) => (
                              <div key={item.id} className={`card-standard flex items-center justify-between ${item.quantity === 0 ? '!border-[var(--status-danger)]' : ''}`}>
                                  <div className="flex-1">
                                      <div className="typo-card-title">{item.name}</div>
                                      {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) && (
                                          <div className="typo-body-dim !mb-0">
                                              {item.weight} {formatUnit(item.weightUnit)}
                                          </div>
                                      )}
                                  </div>
                                  <div className="text-right flex-shrink-0 mx-4">
                                      <span className={`typo-value-normal ${item.quantity === 0 ? 'text-[var(--status-danger)]' : ''}`}>{item.quantity}</span>
                                      <span className="typo-value-small ml-1">{formatUnit(item.unit)}</span>
                                  </div>
                                  <div className="flex justify-end items-center gap-3 no-print flex-shrink-0 w-16">
                                      <button onClick={() => { setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory }); setEditingItem(item); }} className="text-white hover:text-[var(--accent)]"><Edit2 size={14} /></button>
                                      <button onClick={() => setDeletingItem(item)} className="text-white hover:text-red-500"><Trash2 size={14} /></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          ))}
          </div>
      )}

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none px-4 flex items-center justify-center gap-3 z-40 no-print">
          <button onClick={() => setIsAddingSub(true)} className="btn-secondary rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Lagerort</button>
          <button onClick={() => { setItemForm({ name: '', quantity: '1', unit: 'stk', weight: '', weightUnit: 'kg', subcategory: '' }); setIsAddingItem(true); }} className="btn-primary rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Artikel</button>
      </div>

      <AnimatePresence>
        {isAddingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="card-standard w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Artikel</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const newItem = { 
                            id: Date.now().toString(), 
                            name: itemForm.name, 
                            quantity: parseFloat(itemForm.quantity) || 0, 
                            unit: itemForm.unit, 
                            category: activeCategory, 
                            subcategory: itemForm.subcategory,
                            weight: itemForm.weight ? parseFloat(itemForm.weight) : undefined,
                            weightUnit: itemForm.weightUnit
                        };
                        setState({...state, inventory: [...state.inventory, newItem]});
                        setIsAddingItem(false);
                    }}>
                        <div className="space-y-3">
                            <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Name" className="input-standard w-full" />
                            <div className="flex gap-3">
                                <input required type="number" step={formatUnit(itemForm.unit) === 'stk' ? "1" : "0.01"} min={formatUnit(itemForm.unit) === 'stk' ? "1" : "0"} value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} placeholder="Menge" className="input-standard flex-1" />
                                <select value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="input-standard w-24">
                                    <option value="stk">stk</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <input type="number" step="0.01" min="0" value={itemForm.weight} onChange={e => setItemForm({...itemForm, weight: e.target.value})} placeholder="Gewicht pro Stk/Einheit (opt)" className="input-standard flex-1" />
                                <select value={itemForm.weightUnit} onChange={e => setItemForm({...itemForm, weightUnit: e.target.value})} className="input-standard w-24">
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                </select>
                            </div>
                            <select required value={itemForm.subcategory} onChange={e => setItemForm({...itemForm, subcategory: e.target.value})} className="input-standard w-full">
                                <option value="" disabled>Lagerort wählen...</option>
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6"><button type="button" onClick={() => setIsAddingItem(false)} className="btn-secondary flex-1 py-3">Abbrechen</button><button type="submit" className="btn-primary flex-1 py-3">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="card-standard w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Artikel bearbeiten</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const updatedItem = {
                            ...editingItem,
                            name: itemForm.name, 
                            quantity: parseFloat(itemForm.quantity) || 0, 
                            unit: itemForm.unit, 
                            subcategory: itemForm.subcategory,
                            weight: itemForm.weight ? parseFloat(itemForm.weight) : undefined,
                            weightUnit: itemForm.weightUnit
                        };
                        const newInv = state.inventory.map((i:any) => i.id === editingItem.id ? updatedItem : i);
                        setState({...state, inventory: newInv});
                        setEditingItem(null);
                    }}>
                        <div className="space-y-3">
                            <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Name" className="input-standard w-full" />
                            <div className="flex gap-3">
                                <input required type="number" step={formatUnit(itemForm.unit) === 'stk' ? "1" : "0.01"} min={formatUnit(itemForm.unit) === 'stk' ? "1" : "0"} value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} placeholder="Menge" className="input-standard flex-1" />
                                <select value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="input-standard w-24">
                                    <option value="stk">stk</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <input type="number" step="0.01" min="0" value={itemForm.weight} onChange={e => setItemForm({...itemForm, weight: e.target.value})} placeholder="Gewicht pro Stk/Einheit (opt)" className="input-standard flex-1" />
                                <select value={itemForm.weightUnit} onChange={e => setItemForm({...itemForm, weightUnit: e.target.value})} className="input-standard w-24">
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                </select>
                            </div>
                            <select required value={itemForm.subcategory} onChange={e => setItemForm({...itemForm, subcategory: e.target.value})} className="input-standard w-full">
                                <option value="" disabled>Lagerort wählen...</option>
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setEditingItem(null)} className="btn-secondary flex-1 py-3">Abbrechen</button>
                            <button type="submit" className="btn-primary flex-1 py-3">Speichern</button>
                        </div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="card-standard w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Artikel löschen</h2>
                    <p className="typo-body">Willst du <strong>{deletingItem.name}</strong> wirklich aus dem Inhalt entfernen?</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingItem(null)} className="btn-secondary flex-1 py-3">Abbrechen</button>
                        <button onClick={() => {
                            const newInv = state.inventory.filter((i:any) => i.id !== deletingItem.id);
                            setState({...state, inventory: newInv});
                            setDeletingItem(null);
                        }} className="btn-primary flex-1 py-3" style={{ background: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}>Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="card-standard w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Lagerort</h2>
                    <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Name" className="input-standard w-full" />
                    <div className="flex gap-3 mt-6"><button onClick={() => setIsAddingSub(false)} className="btn-secondary flex-1 py-3">Abbrechen</button><button onClick={() => { if(newSubName){ setState({...state, subcategories: {...state.subcategories, [activeCategory]: Array.from(new Set([...(state.subcategories[activeCategory]||[]), newSubName]))}}); setNewSubName(""); setIsAddingSub(false); } }} className="btn-primary flex-1 py-3">Speichern</button></div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="card-standard w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Lagerort umbenennen</h2>
                    <input value={editingSub.new} onChange={e => setEditingSub({...editingSub, new: e.target.value})} placeholder="Neuer Name" className="input-standard w-full" />
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setEditingSub(null)} className="btn-secondary flex-1 py-3">Abbrechen</button>
                        <button onClick={() => {
                            if(editingSub.new && editingSub.new !== editingSub.old) {
                                const newSubs = Array.from(new Set((state.subcategories[activeCategory]||[]).map((s:string) => s === editingSub.old ? editingSub.new : s)));
                                const newInv = state.inventory.map((i:any) => i.category === activeCategory && i.subcategory === editingSub.old ? { ...i, subcategory: editingSub.new } : i);
                                setState({...state, subcategories: {...state.subcategories, [activeCategory]: newSubs}, inventory: newInv});
                            }
                            setEditingSub(null);
                        }} className="btn-primary flex-1 py-3">Speichern</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="card-standard w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Lagerort löschen</h2>
                    <p className="typo-body">Willst du den Lagerort <strong>{deletingSub}</strong> wirklich löschen? Alle {(groupedBySub[deletingSub] || []).length} Artikel darin werden ebenfalls entfernt!</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingSub(null)} className="btn-secondary flex-1 py-3">Abbrechen</button>
                        <button onClick={() => {
                            const newSubs = (state.subcategories[activeCategory]||[]).filter((s:string) => s !== deletingSub);
                            const newInv = state.inventory.filter((i:any) => !(i.category === activeCategory && i.subcategory === deletingSub));
                            setState({...state, subcategories: {...state.subcategories, [activeCategory]: newSubs}, inventory: newInv});
                            setDeletingSub(null);
                        }} className="btn-primary flex-1 py-3" style={{ background: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}>Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- TAB: LOGBUCH ---

const CURRENCIES: Currency[] = ['EUR', 'CHF', 'TRY', 'DKK', 'SEK', 'NOK', 'PLN', 'GBP'];
const FUEL_TYPES: FuelType[] = ['Diesel', 'Benzin', 'Super E10', 'Super E5'];

function LogbuchView({ state, setState }: any) {
  const [logType, setLogType] = useState<'tank' | 'fahrt' | 'spots' | 'archiv'>('tank');
  const [tripLogMode, setTripLogMode] = useState<'flex' | 'strict'>('flex');
  const [isAdding, setIsAdding] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentFuelLog = useMemo(() => {
      const filtered = state.fuelLog.filter((f:any) => new Date(f.date).getFullYear() === currentYear);
      return filtered.sort((a:any, b:any) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff === 0) return b.km - a.km;
          return dateDiff;
      });
  }, [state.fuelLog, currentYear]);
  const currentTripLog = useMemo(() => state.tripLog.filter((t:any) => new Date(t.date).getFullYear() === currentYear), [state.tripLog, currentYear]);
  const currentBusinessTripLog = useMemo(() => (state.businessTripLog || []).filter((t:any) => new Date(t.date).getFullYear() === currentYear).sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()), [state.businessTripLog, currentYear]);
  
  const totalLiters = currentFuelLog.reduce((acc:number, f:any) => acc + f.liters, 0);
  const totalEur = currentFuelLog.reduce((acc:number, f:any) => acc + (f.liters * f.price / (f.exchangeRateToEur || 1)), 0);
  const totalKm = currentTripLog.reduce((acc:number, t:any) => acc + (t.toKm - t.fromKm), 0);

  const avgConsumption = totalKm > 0 ? (totalLiters / totalKm) * 100 : 0;

  const [tankForm, setTankForm] = useState({ date: new Date().toISOString().split('T')[0], km: '', liters: '', price: '', total: '' });
  const [tripForm, setTripForm] = useState({ date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', destination: '', purpose: '', category: 'Privat', note: '' });
  const [businessTripForm, setBusinessTripForm] = useState({ date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: '' });
  const [spotForm, setSpotForm] = useState({ date: new Date().toISOString().split('T')[0], name: '', lat: '', lng: '', note: '', category: 'Stellplatz' });
  const [spotGpsError, setSpotGpsError] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  
  const [displayedTripsCount, setDisplayedTripsCount] = useState(5);
  const [displayedBusinessTripsCount, setDisplayedBusinessTripsCount] = useState(10);
  const [isConfirmingBusinessTrip, setIsConfirmingBusinessTrip] = useState(false);

  const formDateMs = new Date(tankForm.date || new Date().toISOString().split('T')[0]).getTime();
  let minKm = 0;
  let maxKm = Infinity;
  
  useEffect(() => {
    if (isAdding && logType === 'spots') {
      getPosition().then(p => {
          setSpotForm(s => ({ ...s, lat: p.lat.toString(), lng: p.lng.toString() }));
          setSpotGpsError(false);
      }).catch(() => {
          setSpotGpsError(true);
      });
    }
  }, [isAdding, logType]);

  state.fuelLog.forEach((f: any) => {
      const fTime = new Date(f.date).getTime();
      if (fTime < formDateMs) {
          if (f.km > minKm) minKm = f.km;
      } else if (fTime > formDateMs) {
          if (f.km < maxKm) maxKm = f.km;
      }
  });

  const currentKm = parseFloat(tankForm.km);
  const isKmValid = tankForm.km === '' || isNaN(currentKm) || (currentKm >= minKm && currentKm <= maxKm);

  const isTripValid = tripForm.fromKm === '' || tripForm.toKm === '' || parseFloat(tripForm.toKm) >= parseFloat(tripForm.fromKm);
  const isBusinessTripValid = businessTripForm.fromKm === '' || businessTripForm.toKm === '' || parseFloat(businessTripForm.toKm) >= parseFloat(businessTripForm.fromKm);
  const isBusinessTripToday = businessTripForm.date === new Date().toISOString().split('T')[0];

  const handleTankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let newForm = { ...tankForm, [name]: value };
    const l = parseFloat(newForm.liters);
    const p = parseFloat(newForm.price);
    const t = parseFloat(newForm.total);

    if (name === 'liters') {
      if (!isNaN(l) && !isNaN(p)) newForm.total = (l * p).toFixed(2);
    } else if (name === 'price') {
      if (!isNaN(l) && !isNaN(p)) newForm.total = (l * p).toFixed(2);
    } else if (name === 'total') {
      if (!isNaN(t) && !isNaN(l) && l > 0) newForm.price = (t / l).toFixed(3);
    }
    setTankForm(newForm);
  };

  const downloadGPX = () => {
    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="CamperGuard Pro">\n';
    state.spots.forEach((s: any) => {
      gpx += `  <wpt lat="${s.lat}" lon="${s.lng}">\n`;
      gpx += `    <name>${s.category ? `[${s.category}] ` : ''}${s.name}</name>\n`;
      if (s.note || s.category) {
          gpx += `    <desc>${s.category ? `Kategorie: ${s.category}\n` : ''}${s.note || ''}</desc>\n`;
      }
      gpx += `  </wpt>\n`;
    });
    gpx += '</gpx>';
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tour_${new Date().toISOString().split('T')[0]}_Spots.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeYear = () => {
      if(!confirm(`Möchtest du das Jahr ${currentYear} abschließen und archivieren?`)) return;
      const archive = { year: currentYear, totalKm, totalLiters, totalEur, fuelLog: currentFuelLog, tripLog: currentTripLog };
      setState({
          ...state, 
          archives: [...state.archives, archive],
          fuelLog: state.fuelLog.filter((f:any) => new Date(f.date).getFullYear() !== currentYear),
          tripLog: state.tripLog.filter((t:any) => new Date(t.date).getFullYear() !== currentYear)
      });
  };

  const getPosition = () => {
    return new Promise<{lat: number, lng: number}>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            p => resolve({lat: p.coords.latitude, lng: p.coords.longitude}),
            e => reject(e)
        );
    });
  };

  return (
    <>
      <style>{`
        @media print {
            @page { size: A4 portrait; margin: 15mm; }
            body { background: white !important; }
            .logbuch-normal { display: none !important; }
            .logbuch-print-wrapper { display: block !important; width: 100%; color: black !important; }
            .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; font-family: sans-serif; }
            .print-table th { border-bottom: 2px solid #000; padding: 6px; text-align: left; font-weight: bold; text-transform: uppercase; color: #000 !important; background: transparent !important; }
            .print-table td { border-bottom: 1px solid #ccc; padding: 6px; color: #000 !important; vertical-align: top; }
        }
      `}</style>
      <div className="space-y-6 logbuch-normal">
      <ViewTitle right={<button onClick={() => window.print()} className="btn-secondary p-2"><Printer size={16}/></button>}>Logbuch {currentYear}</ViewTitle>

      <div className="bg-[var(--accent)] p-3 rounded-lg flex justify-between items-center text-black shadow-lg sticky top-[-10px] z-20">
          <div className="text-center">
              <div className="typo-label !text-black">Jahres-KM</div>
              <div className="typo-value-normal !text-black">{formatNumber(totalKm, 0)}</div>
          </div>
          <div className="text-center">
              <div className="typo-label !text-black">Liter</div>
              <div className="typo-value-normal !text-black">{formatNumber(totalLiters, 1)}</div>
          </div>
          <div className="text-center">
              <div className="typo-label !text-black">Kosten</div>
              <div className="typo-value-normal !text-black">{formatNumber(totalEur, 2)}€</div>
          </div>
          <div className="text-center">
              <div className="typo-label !text-black">Ø L/100km</div>
              <div className="typo-value-normal !text-black">{formatNumber(avgConsumption, 1)}</div>
          </div>
      </div>

      <div className="flex p-1 bg-[var(--bg-input)] rounded border border-[var(--border)] overflow-x-auto hide-scrollbar">
        {['tank', 'fahrt', 'spots', 'archiv'].map(t => (
            <button key={t} onClick={() => setLogType(t as any)} className={`flex-1 py-3 px-3 rounded typo-label transition-all ${logType === t ? 'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--accent)]/50' : 'text-white hover:text-[var(--accent)] border border-transparent'}`}>
                {t === 'tank' ? 'Tanken' : t === 'spots' ? "POI's" : t === 'fahrt' ? 'Fahrten' : t}
            </button>
        ))}
      </div>

      {logType === 'tank' && (
          <div className="space-y-3">
            {currentFuelLog.map((entry:any) => {
                const totalLocal = entry.price * entry.liters;
                const totalEur = totalLocal / (entry.exchangeRateToEur || 1);
                return (
                    <div key={entry.id} className="card-standard flex justify-between items-center border-l-2" style={{ borderLeftColor: 'var(--accent)' }}>
                        <div className="flex flex-col items-start gap-1">
                            <span className="typo-tiny">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                            <span className="typo-value-normal">{formatNumber(entry.km, 0)} <span className="typo-value-small">KM</span></span>
                            <span className="typo-label" style={{ color: 'var(--accent)' }}>{entry.fuelType}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right flex flex-col justify-end">
                                <div className="flex items-end justify-end gap-2 pb-[2px]">
                                    <span className="typo-card-title !mb-0 leading-tight block">{formatNumber(totalLocal, 2)} {entry.currency}</span>
                                    <span className="typo-card-title !mb-0 leading-tight block" style={{ color: 'var(--accent)' }}>{formatNumber(entry.liters, 1)}<span className="typo-value-small ml-0.5" style={{ color: 'var(--text-muted)' }}>L</span></span>
                                </div>
                                <div className="typo-tiny mt-[2px]">
                                    {formatNumber(entry.price, 2)} {entry.currency}/L 
                                    {entry.currency !== 'EUR' && <span className="ml-1 text-[var(--text-tertiary)]">({formatNumber(totalEur, 2)} €)</span>}
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    if(confirm('Möchtest du diesen Tankeintrag wirklich löschen?')) {
                                        setState({...state, fuelLog: state.fuelLog.filter((f:any) => f.id !== entry.id)});
                                    }
                                }} 
                                className="text-white/30 hover:text-red-500 transition-colors p-2 -mr-2"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                );
            })}
          </div>
      )}

      {logType === 'fahrt' && (
          <div className="space-y-4">
              <div className="flex bg-[var(--bg-input)] p-1 rounded border border-[var(--border)]">
                  <button onClick={() => setTripLogMode('flex')} className={`flex-1 py-2 typo-label rounded ${tripLogMode === 'flex' ? 'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--accent)]/50' : 'text-white/60 hover:text-[var(--accent)] border border-transparent'}`}>Fahrten</button>
                  <button onClick={() => setTripLogMode('strict')} className={`flex-1 py-2 typo-label rounded ${tripLogMode === 'strict' ? 'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--accent)]/50' : 'text-white/60 hover:text-[var(--accent)] border border-transparent'}`}>Fahrtenbuch</button>
              </div>

              {tripLogMode === 'flex' && (
                  <div className="space-y-3">
                      {currentTripLog.slice(0, displayedTripsCount).map((entry:any) => (
                          <div key={entry.id} className="card-standard space-y-3 border-l-2" style={{ borderLeftColor: 'var(--accent)' }}>
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-1 items-start w-2/3">
                                    <span className="typo-tiny">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <h4 className="typo-card-title !mb-0">{entry.destination}</h4>
                                        <span className="typo-label border" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', color: 'var(--accent)' }}>{entry.category || 'Privat'}</span>
                                    </div>
                                    {entry.purpose && <p className="typo-body-dim mt-1 break-words line-clamp-2">{entry.purpose}</p>}
                                    {entry.note && <p className="typo-body-dim italic mt-0.5 break-words line-clamp-2">{entry.note}</p>}
                                </div>
                                <div className="flex flex-col items-end gap-2 w-1/3">
                                    <div className="typo-label" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)', borderWidth: '1px' }}>
                                        +{formatNumber(entry.toKm - entry.fromKm, 0)} KM
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <button onClick={() => {
                                            setEditingTripId(entry.id);
                                            setTripForm({
                                                date: entry.date,
                                                fromKm: entry.fromKm.toString(),
                                                toKm: entry.toKm.toString(),
                                                destination: entry.destination,
                                                purpose: entry.purpose || '',
                                                category: entry.category || 'Privat',
                                                note: entry.note || ''
                                            });
                                            setIsAdding(true);
                                        }} className="text-white/30 hover:text-white transition-colors p-1"><Edit2 size={14}/></button>
                                        <button onClick={() => {
                                            if(confirm('Möchtest du diesen Fahrten-Eintrag wirklich löschen?')) {
                                                setState({...state, tripLog: state.tripLog.filter((t:any) => t.id !== entry.id)});
                                            }
                                        }} className="text-white/30 hover:text-red-500 transition-colors p-1 -mr-2"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                          </div>
                      ))}
                      {currentTripLog.length === 0 && <div className="text-center typo-body-dim mt-8">Keine Einträge</div>}
                      {currentTripLog.length > displayedTripsCount && (
                          <button onClick={() => setDisplayedTripsCount(c => c + 5)} className="btn-secondary w-full py-2 flex flex-row items-center justify-center gap-2">
                              Mehr anzeigen
                          </button>
                      )}
                  </div>
              )}

              {tripLogMode === 'strict' && (
                  <div className="space-y-3">
                      {currentBusinessTripLog.slice(0, displayedBusinessTripsCount).map((entry:any) => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          const isLocked = entry.date < todayStr;
                          return (
                              <div key={entry.id} className={`card-standard space-y-3 border-l-2 border-l-[#2a68a6] ${isLocked ? 'opacity-70' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-1 items-start w-2/3">
                                        <span className="typo-tiny">{new Date(entry.date).toLocaleDateString('de-DE')} {isLocked && <span className="ml-1 text-[8px] bg-white/10 px-1 rounded uppercase tracking-wider">Gespert</span>}</span>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <h4 className="typo-card-title !mb-0">{entry.city ? `${entry.zip} ${entry.city}` : 'Unbekanntes Ziel'}</h4>
                                            <span className="typo-label border-[#2a68a6]/50 text-[#5c9ce6] border">{entry.category || 'Dienstlich'}</span>
                                        </div>
                                        <p className="typo-body-dim !mb-0 mt-1">{entry.street} {entry.houseNumber}</p>
                                        <p className="typo-body-dim mt-1 break-words line-clamp-2">Zweck: {entry.purpose}</p>
                                        {entry.businessPartner && <p className="typo-body-dim italic mt-0.5 break-words line-clamp-2 text-[#5c9ce6]">Partner: {entry.businessPartner}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-2 w-1/3">
                                        <div className="bg-[#2a68a6]/20 text-[#5c9ce6] px-3 py-1 rounded typo-label font-mono border border-[#2a68a6]/40 whitespace-nowrap">
                                            +{formatNumber(entry.toKm - entry.fromKm, 0)} KM
                                        </div>
                                        {!isLocked && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <button onClick={() => {
                                                    setEditingTripId(entry.id);
                                                    setBusinessTripForm({
                                                        date: entry.date,
                                                        fromKm: entry.fromKm.toString(),
                                                        toKm: entry.toKm.toString(),
                                                        category: entry.category,
                                                        street: entry.street || '',
                                                        houseNumber: entry.houseNumber || '',
                                                        zip: entry.zip || '',
                                                        city: entry.city || '',
                                                        purpose: entry.purpose || '',
                                                        businessPartner: entry.businessPartner || '',
                                                        note: entry.note || ''
                                                    });
                                                    setIsAdding(true);
                                                }} className="text-white/30 hover:text-[#5c9ce6] transition-colors p-1"><Edit2 size={14}/></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="typo-tiny mt-2 pt-2 border-t border-[var(--border)] flex justify-between">
                                    <span>Start {formatNumber(entry.fromKm, 0)} KM</span>
                                    <span>Ziel {formatNumber(entry.toKm, 0)} KM</span>
                                </div>
                              </div>
                          );
                      })}
                      {currentBusinessTripLog.length === 0 && <div className="text-center typo-body-dim mt-8">Keine Fahrtenbucheinträge</div>}
                      {currentBusinessTripLog.length > displayedBusinessTripsCount && (
                          <button onClick={() => setDisplayedBusinessTripsCount(c => c + 10)} className="btn-secondary w-full py-2 flex flex-row items-center justify-center gap-2">
                              Mehr anzeigen
                          </button>
                      )}
                  </div>
              )}
          </div>
      )}

      {logType === 'spots' && (
          <div className="space-y-3">
              <button onClick={downloadGPX} className="btn-secondary w-full py-2 mb-4 flex flex-row items-center justify-center gap-2"><FileDown size={14}/> GPX Export</button>
              {state.spots.map((spot:any) => (
                  <div key={spot.id} className="card-standard border-l-2 border-l-blue-500 relative">
                      <div className="flex flex-col">
                         <div className="flex justify-between items-start">
                             <span className="typo-tiny text-white">{new Date(spot.date).toLocaleDateString('de-DE')}</span>
                             <div className="flex items-center gap-2">
                                <button onClick={() => { setSpotForm({ date: spot.date, name: spot.name, lat: spot.lat.toString(), lng: spot.lng.toString(), note: spot.note || '', category: spot.category || 'Stellplatz' }); setEditingSpotId(spot.id); setSpotGpsError(false); setIsAdding(true); }} className="text-white/30 hover:text-[var(--accent)] transition-colors p-1"><Edit2 size={12}/></button>
                                <button onClick={() => { if(confirm('Möchtest du diesen POI-Eintrag wirklich löschen?')) { setState({...state, spots: state.spots.filter((s:any) => s.id !== spot.id)}); } }} className="text-white/30 hover:text-red-500 transition-colors p-1"><Trash2 size={12}/></button>
                             </div>
                         </div>
                         <div className="flex flex-wrap items-center gap-2 mt-1">
                            <h4 className="typo-card-title !mb-0">{spot.name}</h4>
                            {spot.category && <span className="typo-label" style={{ color: 'var(--accent)' }}>{spot.category}</span>}
                         </div>
                         {spot.note && <p className="typo-body-dim mt-1 break-words line-clamp-2">{spot.note}</p>}
                         <a href={`geo:${spot.lat},${spot.lng}`} className="typo-tiny text-[var(--accent)] hover:text-white transition-colors mt-2 flex items-center gap-1 uppercase font-bold"><MapPin size={12}/> {spot.lat.toFixed(4)} / {spot.lng.toFixed(4)}</a>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {logType === 'archiv' && (
          <div className="space-y-4">
              {state.archives.map((a:any) => (
                  <div key={a.year} className="card-standard">
                      <h3 className="typo-section-title pb-2 mb-2 flex items-center gap-2 border-b border-[var(--border)]"><Archive size={14}/> {a.year}</h3>
                      <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                              <div className="typo-label text-[var(--text-muted)]">Distanz</div>
                              <div className="typo-value-normal">{formatNumber(a.totalKm, 0)} KM</div>
                          </div>
                          <div>
                              <div className="typo-label text-[var(--text-muted)]">Liter</div>
                              <div className="typo-value-normal">{formatNumber(a.totalLiters, 1)} L</div>
                          </div>
                          <div>
                              <div className="typo-label text-[var(--text-muted)]">Kosten</div>
                              <div className="typo-value-normal text-[var(--accent)]">{formatNumber(a.totalEur, 2)} €</div>
                          </div>
                      </div>
                  </div>
              ))}
              {state.archives.length === 0 && <div className="text-center typo-body-dim py-8">Keine Archive</div>}
          </div>
      )}

      {logType === 'tank' && (
         <div className="pt-4 flex w-full justify-center pb-24">
             <button onClick={closeYear} className="btn-secondary h-11 px-6 flex flex-row items-center justify-center gap-2 max-w-[240px] w-full"><Archive size={16}/> Jahr abschließen</button>
         </div>
      )}

      {(logType === 'tank' || logType === 'fahrt' || logType === 'spots') && (
          <button 
            onClick={() => { 
                if (logType === 'tank') {
                    setTankForm(f => ({...f, date: new Date().toISOString().split('T')[0]})); 
                } else if (logType === 'fahrt') {
                    setTripForm(f => ({...f, date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', destination: '', purpose: '', category: 'Privat', note: ''}));
                    setBusinessTripForm(f => ({...f, date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: ''}));
                } else if (logType === 'spots') {
                    setSpotForm(f => ({...f, date: new Date().toISOString().split('T')[0], name: '', lat: '', lng: '', note: '', category: 'Stellplatz'}));
                    setSpotGpsError(false);
                }
                setEditingTripId(null);
                setEditingSpotId(null);
                setIsAdding(true); 
            }} 
            className="btn-primary fixed bottom-24 right-4 h-9 px-5 rounded-full flex flex-row items-center justify-center shadow-2xl z-40 border border-[var(--accent-dark)]"
          >
            <Plus size={20} />
          </button>
      )}

      <AnimatePresence>
        {isAdding && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 overflow-y-auto">
                <div className="card-standard w-full max-w-sm my-8">
                    <h2 className="typo-section-title mb-4">{logType === 'tank' ? 'Tankbeleg' : logType === 'fahrt' ? (tripLogMode === 'strict' ? 'Fahrtenbuch' : 'Fahrt-Eintrag') : "POI's Log"}</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const fd = new FormData(e.target);
                        if(logType === 'tank') {
                            const cur = fd.get('currency') as Currency;
                            const rate = state.exchangeRates[cur] || 1;
                            const entry: FuelEntry = { id: Date.now().toString(), date: tankForm.date, km: parseFloat(tankForm.km), liters: parseFloat(tankForm.liters), price: parseFloat(tankForm.price), currency: cur, exchangeRateToEur: rate, fuelType: fd.get('fuelType') as FuelType };
                            setState({...state, fuelLog: [entry, ...state.fuelLog]});
                            setIsAdding(false);
                        } else if(logType === 'fahrt') {
                            if (tripLogMode === 'strict') {
                                setIsConfirmingBusinessTrip(true);
                            } else {
                                const entry: any = { id: editingTripId || Date.now().toString(), date: tripForm.date, fromKm: parseFloat(tripForm.fromKm), toKm: parseFloat(tripForm.toKm), purpose: tripForm.purpose, destination: tripForm.destination, category: tripForm.category, note: tripForm.note };
                                if (editingTripId) {
                                    setState({...state, tripLog: state.tripLog.map((t:any) => t.id === editingTripId ? entry : t)});
                                } else {
                                    setState({...state, tripLog: [entry, ...state.tripLog]});
                                }
                                setEditingTripId(null);
                                setIsAdding(false);
                            }
                        } else if(logType === 'spots') {
                            const entry: SpotEntry = { id: editingSpotId || Date.now().toString(), name: spotForm.name, date: spotForm.date, lat: parseFloat(spotForm.lat), lng: parseFloat(spotForm.lng), note: spotForm.note, category: spotForm.category };
                            if (editingSpotId) {
                                setState({...state, spots: state.spots.map((s:any) => s.id === editingSpotId ? entry : s)});
                            } else {
                                setState({...state, spots: [entry, ...state.spots]});
                            }
                            setEditingSpotId(null);
                            setIsAdding(false);
                        }
                    }}>
                        <div className="space-y-3">
                            <input name="date" required type="date" value={logType === 'fahrt' ? (tripLogMode === 'strict' ? businessTripForm.date : tripForm.date) : (logType === 'spots' ? spotForm.date : tankForm.date)} onChange={(e) => {
                                if (logType === 'fahrt') {
                                    if (tripLogMode === 'strict') setBusinessTripForm({...businessTripForm, date: e.target.value});
                                    else setTripForm({...tripForm, date: e.target.value});
                                } else if (logType === 'spots') {
                                    setSpotForm({...spotForm, date: e.target.value});
                                } else handleTankChange({ target: { name: 'date', value: e.target.value } } as any);
                            }} className="input-standard w-full" />
                            {logType === 'fahrt' && tripLogMode === 'strict' && !isBusinessTripToday && (
                                <span className="typo-tiny block mt-1" style={{ color: 'var(--status-danger)' }}>Fahrtenbuch-Einträge müssen am selben Tag erfasst werden.</span>
                            )}
                            
                            {logType === 'tank' ? (
                                <>
                                    <input name="km" required type="number" placeholder="KM-Stand" value={tankForm.km} onChange={handleTankChange} className={`input-standard w-full ${!isKmValid && tankForm.km !== '' ? '!border-[var(--status-danger)]' : ''}`} />
                                    {!isKmValid && tankForm.km !== '' && (
                                        <span className="typo-tiny block mt-1" style={{ color: 'var(--status-danger)' }}>
                                            {maxKm === Infinity 
                                                ? `Kilometerstand muss mindestens ${formatNumber(minKm, 0)} km betragen.` 
                                                : minKm === 0 
                                                    ? `Kilometerstand darf höchstens ${formatNumber(maxKm, 0)} km betragen.`
                                                    : `Kilometerstand muss zwischen ${formatNumber(minKm, 0)} und ${formatNumber(maxKm, 0)} km liegen.`}
                                        </span>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        <input name="liters" required type="number" step="0.01" placeholder="Liter" value={tankForm.liters} onChange={handleTankChange} className="input-standard w-full" />
                                        <select name="fuelType" className="input-standard w-full">
                                            {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input name="price" required type="number" step="0.001" placeholder="Preis/Liter" value={tankForm.price} onChange={handleTankChange} className="input-standard w-full" />
                                        <input name="total" type="number" step="0.01" placeholder="Gesamtbetrag" value={tankForm.total} onChange={handleTankChange} className="input-standard w-full" />
                                    </div>
                                    <select name="currency" className="input-standard w-full mt-2">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </>
                            ) : logType === 'fahrt' ? (
                                tripLogMode === 'strict' ? (
                                    <>
                                        <select name="category" value={businessTripForm.category} onChange={e => setBusinessTripForm({...businessTripForm, category: e.target.value})} className="input-standard w-full">
                                            <option value="Dienstlich">Dienstlich</option>
                                            <option value="Privat">Privat</option>
                                            <option value="Betriebsstätte">Betriebsstätte</option>
                                        </select>
                                        <div className="flex gap-2">
                                            <input name="fromKm" required type="number" placeholder="Start KM" value={businessTripForm.fromKm} onChange={e => setBusinessTripForm({...businessTripForm, fromKm: e.target.value})} className="input-standard w-1/2" />
                                            <input name="toKm" required type="number" placeholder="Ziel KM" value={businessTripForm.toKm} onChange={e => setBusinessTripForm({...businessTripForm, toKm: e.target.value})} className={`input-standard w-1/2 ${!isBusinessTripValid && businessTripForm.toKm !== '' ? '!border-[var(--status-danger)]' : ''}`} />
                                        </div>
                                        {!isBusinessTripValid && businessTripForm.toKm !== '' && <span className="typo-tiny block mt-1" style={{ color: 'var(--status-danger)' }}>Ziel KM muss größer als Start KM sein.</span>}
                                        <div className="flex gap-2">
                                            <input name="street" required placeholder="Straße" value={businessTripForm.street} onChange={e => setBusinessTripForm({...businessTripForm, street: e.target.value})} className="input-standard w-3/4" />
                                            <input name="houseNumber" required placeholder="Nr." value={businessTripForm.houseNumber} onChange={e => setBusinessTripForm({...businessTripForm, houseNumber: e.target.value})} className="input-standard w-1/4" />
                                        </div>
                                        <div className="flex gap-2">
                                            <input name="zip" required placeholder="PLZ" value={businessTripForm.zip} onChange={e => setBusinessTripForm({...businessTripForm, zip: e.target.value})} className="input-standard w-1/3" />
                                            <input name="city" required placeholder="Ort" value={businessTripForm.city} onChange={e => setBusinessTripForm({...businessTripForm, city: e.target.value})} className="input-standard w-2/3" />
                                        </div>
                                        <input name="purpose" required placeholder="Zweck" value={businessTripForm.purpose} onChange={e => setBusinessTripForm({...businessTripForm, purpose: e.target.value})} className="input-standard w-full" />
                                        {businessTripForm.category === 'Dienstlich' && (
                                            <input name="businessPartner" placeholder="Geschäftspartner (optional)" value={businessTripForm.businessPartner} onChange={e => setBusinessTripForm({...businessTripForm, businessPartner: e.target.value})} className="input-standard w-full" />
                                        )}
                                        <textarea name="note" placeholder="Notiz / Routenhinweis (optional)" value={businessTripForm.note} onChange={e => setBusinessTripForm({...businessTripForm, note: e.target.value})} className="input-standard w-full h-16" />
                                    </>
                                ) : (
                                    <>
                                        <select name="category" value={tripForm.category} onChange={e => setTripForm({...tripForm, category: e.target.value})} className="input-standard w-full">
                                            <option value="Privat">Privat</option>
                                            <option value="Dienstlich">Dienstlich</option>
                                            <option value="Arbeitsweg">Arbeitsweg</option>
                                        </select>
                                        <div className="flex gap-2">
                                            <input name="fromKm" required type="number" placeholder="Start KM" value={tripForm.fromKm} onChange={e => setTripForm({...tripForm, fromKm: e.target.value})} className="input-standard w-1/2" />
                                            <input name="toKm" required type="number" placeholder="Ziel KM" value={tripForm.toKm} onChange={e => setTripForm({...tripForm, toKm: e.target.value})} className={`input-standard w-1/2 ${!isTripValid && tripForm.toKm !== '' ? '!border-[var(--status-danger)]' : ''}`} />
                                        </div>
                                        {!isTripValid && tripForm.toKm !== '' && <span className="typo-tiny block mt-1" style={{ color: 'var(--status-danger)' }}>Ziel KM muss größer oder gleich Start KM sein.</span>}
                                        <input name="destination" required placeholder="Zielort" value={tripForm.destination} onChange={e => setTripForm({...tripForm, destination: e.target.value})} className="input-standard w-full" />
                                        <input name="purpose" placeholder="Zweck (optional)" value={tripForm.purpose} onChange={e => setTripForm({...tripForm, purpose: e.target.value})} className="input-standard w-full" />
                                        <textarea name="note" placeholder="Notiz (optional)" value={tripForm.note} onChange={e => setTripForm({...tripForm, note: e.target.value})} className="input-standard w-full h-20" />
                                    </>
                                )
                            ) : (
                                <>
                                    <input name="name" required placeholder="POI Name" value={spotForm.name} onChange={e => setSpotForm({...spotForm, name: e.target.value})} className="input-standard w-full" />
                                    <select name="category" value={spotForm.category} onChange={e => setSpotForm({...spotForm, category: e.target.value})} className="input-standard w-full">
                                        <option value="Stellplatz">Stellplatz</option>
                                        <option value="Freistehen">Freistehen</option>
                                        <option value="Campingplatz">Campingplatz</option>
                                        <option value="Entsorgung">Entsorgung</option>
                                        <option value="Versorgung">Versorgung</option>
                                        <option value="Einkauf">Einkauf</option>
                                        <option value="Aussicht">Aussicht</option>
                                        <option value="Sonstiges">Sonstiges</option>
                                    </select>
                                    {spotGpsError && <span className="typo-tiny block mt-1" style={{ color: 'var(--status-danger)' }}>GPS nicht verfügbar</span>}
                                    <div className="flex gap-2 items-center">
                                        <button type="button" onClick={async () => {
                                            try { 
                                                const p = await getPosition(); 
                                                setSpotForm(s => ({...s, lat: p.lat.toString(), lng: p.lng.toString()})); 
                                                setSpotGpsError(false);
                                            } catch(err){ 
                                                setSpotGpsError(true);
                                            }
                                        }} className="p-3 bg-blue-500 text-white rounded border border-blue-400 font-black"><MapPin size={18}/></button>
                                        <input name="lat" required type="number" step="any" placeholder="Lat" value={spotForm.lat} onChange={e => setSpotForm({...spotForm, lat: e.target.value})} className="input-standard w-1/2" />
                                        <input name="lng" required type="number" step="any" placeholder="Lng" value={spotForm.lng} onChange={e => setSpotForm({...spotForm, lng: e.target.value})} className="input-standard w-1/2" />
                                    </div>
                                    <textarea name="note" placeholder="Notiz" value={spotForm.note} onChange={e => setSpotForm({...spotForm, note: e.target.value})} className="input-standard w-full h-24" />
                                </>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6"><button type="button" onClick={() => { setIsAdding(false); setEditingTripId(null); setEditingSpotId(null); setIsConfirmingBusinessTrip(false); }} className="btn-secondary flex-1 py-3">Abbrechen</button><button type="submit" disabled={(logType === 'tank' && !isKmValid) || (logType === 'fahrt' && tripLogMode === 'flex' && !isTripValid) || (logType === 'fahrt' && tripLogMode === 'strict' && (!isBusinessTripValid || !isBusinessTripToday))} className="btn-primary flex-1 py-3 disabled:opacity-50">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isConfirmingBusinessTrip && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4">
                <div className="card-standard w-full max-w-sm" style={{ borderColor: 'var(--accent)' }}>
                    <h2 className="typo-section-title mb-2">Verbindlich Speichern?</h2>
                    <p className="typo-body mb-6">
                        Bitte prüfe alle Angaben sorgfältig.<br/><br/>Fahrtenbuch-Einträge sind nur am selben Tag änderbar und danach gesperrt.<br/><br/>Möchtest du diesen Eintrag verbindlich speichern?
                    </p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => {
                            const entry: any = { 
                                id: editingTripId || Date.now().toString(), 
                                date: businessTripForm.date, 
                                fromKm: parseFloat(businessTripForm.fromKm), 
                                toKm: parseFloat(businessTripForm.toKm), 
                                category: businessTripForm.category,
                                street: businessTripForm.street,
                                houseNumber: businessTripForm.houseNumber,
                                zip: businessTripForm.zip,
                                city: businessTripForm.city,
                                purpose: businessTripForm.purpose,
                                businessPartner: businessTripForm.businessPartner,
                                note: businessTripForm.note
                            };
                            const currentBusinessTrips = state.businessTripLog || [];
                            if (editingTripId) {
                                setState({...state, businessTripLog: currentBusinessTrips.map((t:any) => t.id === editingTripId ? entry : t)});
                            } else {
                                setState({...state, businessTripLog: [entry, ...currentBusinessTrips]});
                            }
                            setEditingTripId(null);
                            setIsConfirmingBusinessTrip(false);
                            setIsAdding(false);
                        }} className="btn-primary w-full py-3">Verbindlich speichern</button>
                        <button onClick={() => setIsConfirmingBusinessTrip(false)} className="btn-secondary w-full py-3">Zurück zur Prüfung</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      </div>

      <div className="hidden print-only logbuch-print-wrapper bg-white">
          <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
              <div>
                  <h1 className="text-xl font-black uppercase tracking-widest">{state.profile.vehicleName || "Camper"}</h1>
                  <p className="text-xs font-bold uppercase">{state.profile.plate || "Kennzeichen"}</p>
              </div>
              <h2 className="text-lg font-black uppercase">
                  Logbuch - {logType === 'tank' ? 'Tanken' : logType === 'fahrt' ? (tripLogMode === 'strict' ? 'Fahrtenbuch' : 'Fahrten') : logType === 'spots' ? "POI's" : 'Archiv'}
              </h2>
          </div>

          {logType === 'tank' && (
             currentFuelLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <table className="print-table">
                 <thead><tr><th>Datum</th><th>Kilometerstand</th><th>Kraftstoff</th><th>Liter</th><th>Preis/L</th><th>Gesamtpreis</th></tr></thead>
                 <tbody>
                     {currentFuelLog.map((f:any) => (
                         <tr key={f.id}>
                             <td>{new Date(f.date).toLocaleDateString('de-DE')}</td>
                             <td>{formatNumber(f.km, 0)} KM</td>
                             <td>{f.fuelType}</td>
                             <td>{formatNumber(f.liters, 2)} L</td>
                             <td>{formatNumber(f.price, 3)} €</td>
                             <td>{formatNumber((f.liters * f.price) / (f.exchangeRateToEur || 1), 2)} €</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          )}

          {logType === 'fahrt' && tripLogMode === 'flex' && (
             currentTripLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <table className="print-table">
                 <thead><tr><th>Datum</th><th>Kategorie</th><th>Zielort</th><th>Zweck</th><th>Start KM</th><th>Ziel KM</th><th>Strecke</th><th>Notiz</th></tr></thead>
                 <tbody>
                     {currentTripLog.map((t:any) => (
                         <tr key={t.id}>
                             <td>{new Date(t.date).toLocaleDateString('de-DE')}</td>
                             <td>{t.category || 'Privat'}</td>
                             <td>{t.destination}</td>
                             <td>{t.purpose}</td>
                             <td>{formatNumber(t.fromKm, 0)}</td>
                             <td>{formatNumber(t.toKm, 0)}</td>
                             <td>{formatNumber(t.toKm - t.fromKm, 0)} KM</td>
                             <td>{t.note}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          )}

          {logType === 'fahrt' && tripLogMode === 'strict' && (
             currentBusinessTripLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <table className="print-table">
                 <thead><tr><th>Datum</th><th>Kategorie</th><th>Start KM</th><th>Ziel KM</th><th>Strecke</th><th>Straße</th><th>Hausnr.</th><th>PLZ</th><th>Ort</th><th>Zweck</th><th>Geschäftspartner</th><th>Notiz / Route</th></tr></thead>
                 <tbody>
                     {currentBusinessTripLog.map((t:any) => (
                         <tr key={t.id}>
                             <td>{new Date(t.date).toLocaleDateString('de-DE')}</td>
                             <td>{t.category}</td>
                             <td>{formatNumber(t.fromKm, 0)}</td>
                             <td>{formatNumber(t.toKm, 0)}</td>
                             <td>{formatNumber(t.toKm - t.fromKm, 0)} KM</td>
                             <td>{t.street}</td>
                             <td>{t.houseNumber}</td>
                             <td>{t.zip}</td>
                             <td>{t.city}</td>
                             <td>{t.purpose}</td>
                             <td>{t.businessPartner}</td>
                             <td>{t.note}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          )}

          {logType === 'spots' && (
             state.spots.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <table className="print-table">
                 <thead><tr><th>Datum</th><th>Name</th><th>Kategorie</th><th>Latitude</th><th>Longitude</th><th>Notiz</th></tr></thead>
                 <tbody>
                     {state.spots.map((s:any) => (
                         <tr key={s.id}>
                             <td>{new Date(s.date).toLocaleDateString('de-DE')}</td>
                             <td>{s.name}</td>
                             <td>{s.category || 'Stellplatz'}</td>
                             <td>{s.lat.toFixed(6)}</td>
                             <td>{s.lng.toFixed(6)}</td>
                             <td>{s.note}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          )}

          <div className="mt-10 pt-4 border-t border-gray-300 flex justify-between typo-label">
              <span>CamperGuard Pro</span>
              <span>Gedruckt am: {new Date().toLocaleDateString('de-DE')}</span>
          </div>
      </div>
    </>
  );
}
// --- TAB: REISE ---

const MapHandlerComponent = ({ destination, setDestination, setDistance, range }: { destination: [number, number] | null, setDestination: (d: [number, number]) => void, setDistance: (d: number) => void, range: number }) => {
  useMapEvents({
    click(e) {
      setDestination([e.latlng.lat, e.latlng.lng]);
      setDistance(Math.floor(Math.random() * (range * 0.8)) + 50); // dummy dist
    },
  });
  return destination ? <Marker position={destination} /> : null;
};

const ResizeMapComponent = () => {
  const map = useMap();
  useEffect(() => {
    globalLeafletMap = map;
    return () => { globalLeafletMap = null; };
  }, [map]);
  return null;
};

function ReiseView({ state, setState, orientation }: any) {
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  const pitchNormalized = Math.max(-20, Math.min(20, orientation?.pitch || 0));
  const rollNormalized = Math.max(-20, Math.min(20, orientation?.roll || 0));
  const heading = orientation?.heading || 0;

  useEffect(() => {
    const t = setTimeout(() => {
      // @ts-ignore
      if(globalLeafletMap) globalLeafletMap.invalidateSize({debounce: false});
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const avgConsumption = useMemo(() => {
    if (state.fuelLog.length < 2) return 11.5;
    const sorted = [...state.fuelLog].sort((a,b) => b.km - a.km);
    const totalDist = sorted[0].km - sorted[sorted.length - 1].km;
    const totalLiters = sorted.slice(0, -1).reduce((acc:number, curr:any) => acc + curr.liters, 0);
    return totalDist > 0 ? (totalLiters / totalDist) * 100 : 11.5;
  }, [state.fuelLog]);

  const range = ((state.profile.dieselCapacity || 80) / avgConsumption) * 100;

  const isCritical = distance ? distance > range : false;

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-140px)]">
      <ViewTitle>Reise</ViewTitle>
      
      <Card className="card-standard bg-gradient-to-br from-[#1c1e20] to-[#121314] shadow-[inset_0_2px_3px_rgba(255,255,255,0.03),_inset_0_-2px_4px_rgba(0,0,0,0.5),_0_4px_20px_rgba(0,0,0,0.8)] border border-[#2a2c2e]">
        <div className="typo-section-title mb-4">LAGE & KOMPASS</div>
        <div className="flex justify-center items-center gap-6">
            <div className="flex flex-col items-center justify-center w-[80px] h-[80px] bg-gradient-to-b from-[#1a1c1e] to-[#0a0b0c] rounded-xl shadow-[inset_0_3px_6px_rgba(0,0,0,0.8),_inset_0_-1px_1px_rgba(255,255,255,0.05),_0_2px_5px_rgba(0,0,0,0.5)] border border-[#222]">
               <div className="text-[10px] text-[#666] font-bold tracking-widest mb-1">ROLL</div>
               <div className="text-2xl font-mono font-light text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                 {Math.abs(Math.round(rollNormalized))}<span className="text-sm text-[#555] ml-0.5">°</span>
               </div>
            </div>

            <div className="relative w-[230px] h-[230px] flex items-center justify-center bg-gradient-to-br from-[#5a5c5e] via-[#3a3c3e] to-[#151719] rounded-full p-[26px] shadow-[0_20px_40px_rgba(0,0,0,0.9),_inset_0_2px_6px_rgba(255,255,255,0.25),_inset_0_-3px_12px_rgba(0,0,0,0.9)] border-2 border-[#555] ring-2 ring-[#0a0a0a]">
              
              {/* Inner recessed shadow/ring */}
              <div className="absolute inset-[20px] rounded-full bg-[#050505] shadow-[inset_0_5px_12px_rgba(0,0,0,1),_0_1px_2px_rgba(255,255,255,0.15)] pointer-events-none" />
              
              {/* Compass marks on the outer ring */}
              <div 
                className="absolute inset-0 transition-transform duration-500 ease-out" 
                style={{ transform: `rotate(${-heading || 0}deg)` }}
              >
                <div className="absolute top-[6px] left-1/2 -translate-x-1/2 text-[12px] font-black text-[#999] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] tracking-widest z-10">N</div>
                <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 text-[12px] font-black text-[#999] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] tracking-widest z-10">S</div>
                <div className="absolute left-[8px] top-1/2 -translate-y-1/2 text-[12px] font-black text-[#999] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] tracking-widest z-10">W</div>
                <div className="absolute right-[8px] top-1/2 -translate-y-1/2 text-[12px] font-black text-[#999] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] tracking-widest z-10">E</div>

                {/* Orange accented N-tick */}
                <div className="absolute top-[22px] left-1/2 -translate-x-1/2 w-[6px] h-[6px] rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent),_inset_0_1px_1px_rgba(255,255,255,0.5)] z-10" />

                {/* Small dots for 45 deg angles */}
                <div className="absolute top-[35px] right-[35px] w-[5px] h-[5px] rounded-full bg-[#666] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8),_0_1px_0_rgba(255,255,255,0.2)] z-10" />
                <div className="absolute bottom-[35px] right-[35px] w-[5px] h-[5px] rounded-full bg-[#666] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8),_0_1px_0_rgba(255,255,255,0.2)] z-10" />
                <div className="absolute bottom-[35px] left-[35px] w-[5px] h-[5px] rounded-full bg-[#666] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8),_0_1px_0_rgba(255,255,255,0.2)] z-10" />
                <div className="absolute top-[35px] left-[35px] w-[5px] h-[5px] rounded-full bg-[#666] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8),_0_1px_0_rgba(255,255,255,0.2)] z-10" />
              </div>

              <div className="relative w-full h-full flex items-center justify-center rounded-full bg-[radial-gradient(ellipse_at_top,_#242628_0%,_#0a0b0c_70%,_#000000_100%)] shadow-[inset_0_30px_60px_rgba(0,0,0,1),_inset_0_4px_15px_rgba(0,0,0,0.8),_0_2px_4px_rgba(255,255,255,0.1)] border border-black overflow-hidden z-20">
                 <div className="absolute top-0 left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                 
                 <div className="absolute w-[1px] h-full bg-gradient-to-b from-transparent via-[#444] to-transparent left-1/2 -translate-x-1/2 shadow-[0_0_2px_rgba(0,0,0,0.5)]" />
                 <div className="absolute h-[1px] w-full bg-gradient-to-r from-transparent via-[#444] to-transparent top-1/2 -translate-y-1/2 shadow-[0_0_2px_rgba(0,0,0,0.5)]" />
                 
                 <div className="absolute w-[120px] h-[120px] rounded-full border border-[#333] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5),_0_1px_1px_rgba(255,255,255,0.05)]" />
                 <div className="absolute w-[80px] h-[80px] rounded-full border border-[#2a2a2a] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5),_0_1px_1px_rgba(255,255,255,0.05)]" />
                 
                 <div className="absolute w-[36px] h-[36px] rounded-full border border-[#22c55e]/30 bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.25)_0%,_transparent_70%)] shadow-[0_0_20px_rgba(34,197,94,0.35),_inset_0_0_15px_rgba(34,197,94,0.25)]" />
                 
                 <div className="absolute z-10 text-white/10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
                     <Truck size={24} style={{ transform: `rotate(${heading}deg)` }} />
                 </div>

                 <motion.div 
                    className="absolute w-8 h-8 rounded-full z-20 overflow-hidden"
                    style={{
                       background: 'radial-gradient(circle at 30% 30%, #86efac 0%, #22c55e 40%, #15803d 80%, #064e3b 100%)',
                       boxShadow: '0 8px 20px rgba(34,197,94,0.4), inset 0 3px 6px rgba(255,255,255,0.6), inset 0 -4px 8px rgba(0,0,0,0.8), inset 0 0 4px rgba(134,239,172,0.5)',
                       border: '1px solid rgba(255,255,255,0.15)'
                    }}
                    animate={{ 
                       x: rollNormalized * 3.5,
                       y: pitchNormalized * 3.5 
                    }}
                    transition={{ type: 'spring', bounce: 0.25, stiffness: 100 }}
                 >
                     <div className="absolute top-[3px] left-[6px] w-[10px] h-[5px] bg-white/80 rounded-full rotate-[-45deg] blur-[0.5px]" />
                     <div className="absolute bottom-[4px] right-[6px] w-[6px] h-[3px] bg-black/50 rounded-full blur-[1px] rotate-[-45deg]" />
                 </motion.div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center w-[80px] h-[80px] bg-gradient-to-b from-[#1a1c1e] to-[#0a0b0c] rounded-xl shadow-[inset_0_3px_6px_rgba(0,0,0,0.8),_inset_0_-1px_1px_rgba(255,255,255,0.05),_0_2px_5px_rgba(0,0,0,0.5)] border border-[#222]">
               <div className="text-[10px] text-[#666] font-bold tracking-widest mb-1">PITCH</div>
               <div className="text-2xl font-mono font-light text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                 {Math.abs(Math.round(pitchNormalized))}<span className="text-sm text-[#555] ml-0.5">°</span>
               </div>
            </div>
          </div>
          <div className="flex justify-center mt-8 mb-2">
            <div className="flex items-center gap-4 px-6 py-3 bg-gradient-to-b from-[#1a1c1e] to-[#0a0b0c] rounded-2xl shadow-[inset_0_3px_6px_rgba(0,0,0,0.8),_inset_0_-1px_2px_rgba(255,255,255,0.05),_0_4px_12px_rgba(0,0,0,0.5)] border border-[#222]">
              <div className="text-[11px] text-[#666] font-bold tracking-widest uppercase">HEADING</div>
              <div className="text-2xl font-mono font-light text-[var(--accent)] drop-shadow-[0_0_8px_rgba(255,102,0,0.3)] mt-0.5">
                {Math.round(heading)}<span className="text-sm opacity-50 ml-0.5">°</span>
              </div>
            </div>
          </div>
      </Card>

      <Card className="card-standard p-0 overflow-hidden relative border-[var(--border)] z-0 h-[400px] w-full">
          <MapContainer id="map" center={[51.1657, 10.4515]} zoom={6} zoomControl={false} style={{ height: '100%', width: '100%', background: 'var(--bg-input)' }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <MapHandlerComponent destination={destination} setDestination={setDestination} setDistance={setDistance} range={range} />
            <ResizeMapComponent />
          </MapContainer>
      </Card>

    </div>
  );
}

// --- TAB: PROFIL ---

const faqData = [
  {q: "Warum Medikationsdaten?", a: "Im Notfall zählen Sekunden. Rettungskräfte sehen sofort lebenswichtige Infos im Safety Hub."},
  {q: "Wo werden meine Daten gespeichert?", a: "Alle Daten bleiben lokal in deinem Browser (IndexedDB). Es findet kein Cloud-Upload statt."},
  {q: "Was ist der ICE 2 Kontakt?", a: "Ein zweiter Notfallkontakt für den Fall, dass die primäre Kontaktperson nicht erreichbar ist."},
  {q: "Wofür dienen die Fahrzeugdaten?", a: "Sie helfen bei der Berechnung von Verbräuchen und erinnern an wichtige Service-Intervalle."},
  {q: "Was bedeuten Heading und Elevation?", a: "Heading zeigt deine Kompassrichtung, Elevation deine aktuelle Höhe über dem Meeresspiegel."},
  {q: "Warum gibt es ein Audio-Feedback?", a: "Der Success-Chime signalisiert dir exakt 0.0° Neigung, ohne dass du aufs Display schauen musst."},
  {q: "Wie funktionieren die Lagerorte?", a: "Du kannst jedem Gegenstand bis zu zwei feste Plätze (z.B. Heckgarage, Schrank links) zuweisen."},
  {q: "Was bedeutet 'Bestand 0'?", a: "Gegenstände mit Bestand 0 werden markiert, damit du sie vor der nächsten Tour nachkaufst."},
  {q: "Warum wird das KM-Feld rot?", a: "Das ist ein Schutz vor Tippfehlern. Der KM-Stand muss immer höher sein als beim letzten Mal."},
  {q: "Wie funktioniert der Tank-Rechner?", a: "Gib zwei Werte ein (z.B. Liter und Preis), der dritte Wert wird automatisch ausgerechnet."},
  {q: "Was passiert bei der Archivierung?", a: "Alte Touren werden schreibgeschützt abgelegt, um die aktuelle Liste übersichtlich zu halten."},
  {q: "Wie nutze ich den GPS-Sync?", a: "Ein Klick übernimmt deine aktuellen Koordinaten direkt in einen neuen Point of Interest (POI)."},
  {q: "Was mache ich mit dem GPX-Export?", a: "Du kannst deine Touren exportieren und in Garmin, TomTom oder Google Earth importieren."},
  {q: "Die Karte lädt nicht richtig?", a: "Ein integrierter Fix (200ms Delay) sorgt beim Tab-Wechsel für das korrekte Nachladen der Kacheln."},
  {q: "Ist die App auf Tablets nutzbar?", a: "Ja, ab 10 Zoll schaltet die App automatisch in ein optimiertes Zwei-Spalten-Layout."},
  {q: "Funktioniert die App auch im Tunnel?", a: "Die App ist offline-fähig. Nur die Kartenkacheln benötigen eine aktive Internetverbindung."},
  {q: "Wo finde ich das Logo auf Ausdrucken?", a: "Das CamperGuard Pro Logo wird automatisch unten links auf jedem PDF/Druck platziert."},
  {q: "Kann ich Lagerorte umbenennen?", a: "Ja, die Bezeichnungen der Staufächer können in den Einstellungen individuell angepasst werden."},
  {q: "Warum sollte ich GPS deaktivieren?", a: "Im Safety Hub kannst du GPS manuell ausschalten, um Akku zu sparen oder deine Privatsphäre zu schützen."},
  {q: "Was schreibe ich in das Zweck-Feld?", a: "Hier ist Platz für Notizen zur Tour, wie z.B. 'Schönster Stellplatz' oder 'Werkstattbesuch'."}
];

function ProfilView({ state, setState, demoSeed }: any) {
  const [activeTireProfile, setActiveTireProfile] = useState<TireProfile>('Straße');
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");

  const hc = (path: string, val: any) => {
    setState((prev:any) => {
        const next = {...prev};
        const p = path.split('.');
        let c: any = next;
        for(let i=0; i<p.length-1; i++) {
          c[p[i]] = Array.isArray(c[p[i]]) ? [...c[p[i]]] : {...c[p[i]]};
          c = c[p[i]];
        }
        c[p[p.length-1]] = val;
        return next;
    });
  };

  const tp = state.profile.tires[activeTireProfile] || { frontLeft:0, frontRight:0, rearLeft:0, rearRight:0 };
  const TIRE_PROFILES: TireProfile[] = ['Straße', 'Sand/Dünen', 'Schlamm/Matsch', 'Felsgelände', 'Geröll/Schotter', 'Wasser/Furten', 'Schnee/Eis', 'Erde/Wiese'];

  const parsePlate = (plateStr: string) => {
      const s = plateStr || "";
      if (s.includes('-')) {
          const p = s.split('-');
          return [p[0] || '', p[1] || '', p.slice(2).join('-') || ''];
      }
      if (s.includes(' ')) {
          const p = s.split(' ');
          return [p[0] || '', p[1] || '', p.slice(2).join(' ') || ''];
      }
      return [s, "", ""];
  };
  const [p1, p2, p3] = parsePlate(state.profile.plate);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-end mb-4 px-2 no-print">
          <h1 className="typo-section-title">FAHRZEUG</h1>
          <button onClick={() => setShowFaqModal(true)} className="btn-secondary typo-label normal-case px-2 py-1 leading-none">FAQ</button>
      </div>
      
      <div className="card-standard space-y-4">
          <div><label className="typo-label mb-2 block">Camper Name</label><input value={state.profile.vehicleName} onChange={e => hc('profile.vehicleName', e.target.value)} placeholder="Spitzname..." className="input-standard w-full" style={{ fontSize: '18px', fontWeight: 900 }} /></div>
          <div>
            <label className="typo-label mb-2 block">Kennzeichen</label>
            <div className="flex gap-2 items-center">
                <input value={p1} maxLength={3} onChange={e => hc('profile.plate', [e.target.value.toUpperCase().trim(), p2, p3].join('-'))} placeholder="B" className="input-standard w-20 text-center uppercase" />
                <span className="typo-body-dim !mb-0">–</span>
                <input value={p2} maxLength={2} onChange={e => hc('profile.plate', [p1, e.target.value.toUpperCase().trim(), p3].join('-'))} placeholder="CG" className="input-standard w-16 text-center uppercase" />
                <span className="typo-body-dim !mb-0">–</span>
                <input value={p3} maxLength={4} onChange={e => hc('profile.plate', [p1, p2, e.target.value.toUpperCase().trim()].join('-'))} placeholder="1234" className="input-standard w-24 text-center uppercase font-mono" />
            </div>
          </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
          {[ { l: 'Höhe', k: 'height' }, { l: 'Breite', k: 'width' }, { l: 'Länge', k: 'length' } ].map(d => (
              <div key={d.k} className={`card-standard p-3 text-center ${!state.profile[d.k] ? 'animate-pulse-border' : ''}`}>
                  <span className="typo-label mb-1 block">{d.l} <span className="typo-value-small">m</span></span>
                  <input type="number" step="0.01" value={state.profile[d.k]} onChange={e => hc(`profile.${d.k}`, parseFloat(e.target.value))} className={`input-standard w-full text-center py-1 ${!state.profile[d.k] ? 'text-[var(--text-muted)]' : 'text-white'}`} style={{ border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, backgroundColor: 'transparent' }} />
              </div>
          ))}
      </div>

      <div className="card-standard space-y-4">
          <div className="grid grid-cols-2 gap-3">
              <div className={`card-standard p-3 flex flex-col items-center justify-center ${!state.profile.emptyWeight ? 'animate-pulse-border' : ''}`}>
                  <span className="typo-label mb-1">Leergewicht</span>
                  <div className="flex items-baseline gap-1">
                    <input type="number" value={state.profile.emptyWeight} onChange={e => hc('profile.emptyWeight', parseFloat(e.target.value))} className={`input-standard w-16 text-center ${!state.profile.emptyWeight ? 'text-[var(--text-muted)]' : 'text-white'}`} style={{ border: 'none', backgroundColor: 'transparent', padding: 0 }} />
                    <span className="typo-value-small">kg</span>
                  </div>
              </div>
              <div className={`card-standard p-3 flex flex-col items-center justify-center ${!state.profile.maxWeight ? 'animate-pulse-border' : ''}`}>
                  <span className="typo-label mb-1">ZGG</span>
                  <div className="flex items-baseline gap-1">
                    <input type="number" value={state.profile.maxWeight} onChange={e => hc('profile.maxWeight', parseFloat(e.target.value))} className={`input-standard w-16 text-center ${!state.profile.maxWeight ? 'text-[var(--text-muted)]' : 'text-[var(--accent)]'}`} style={{ border: 'none', backgroundColor: 'transparent', padding: 0 }} />
                    <span className="typo-value-small">kg</span>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
              {[ { l: 'Frischwasser', k: 'freshWaterCapacity' }, { l: 'Abwasser', k: 'wasteWaterCapacity' }, { l: 'Diesel', k: 'dieselCapacity' } ].map(d => (
                  <div key={d.k} className={`card-standard p-3 flex flex-col items-center justify-center ${!state.profile[d.k as keyof typeof state.profile] ? 'animate-pulse-border' : ''}`}>
                      <span className="typo-label mb-1 text-center">{d.l}</span>
                      <div className="flex items-baseline gap-1">
                        <input type="number" value={state.profile[d.k as keyof typeof state.profile]} onChange={e => hc(`profile.${d.k}`, parseFloat(e.target.value) || 0)} className={`input-standard w-14 text-center ${!state.profile[d.k as keyof typeof state.profile] ? 'text-[var(--text-muted)]' : 'text-white'}`} style={{ border: 'none', backgroundColor: 'transparent', padding: 0 }} />
                        <span className="typo-value-small">L</span>
                      </div>
                  </div>
              ))}
          </div>
          
          <div className="space-y-3 pt-2">
            <span className="typo-section-title mb-2 block">Wartungs-Termine</span>
            {state.maintenance.map((m:any, idx:number) => (
                <div key={m.id} className="flex items-center gap-3">
                    <span className="typo-label w-24">{m.name}</span>
                    <input type="date" value={m.date} onChange={(e) => { const nm = [...state.maintenance]; nm[idx].date = e.target.value; setState({...state, maintenance: nm}); }} className={`input-standard flex-1 ${!m.date ? 'animate-pulse-border text-[var(--text-muted)]' : ''}`} />
                </div>
            ))}
          </div>
      </div>

      <div className="card-standard space-y-4 border-l-4" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="flex justify-between items-center">
             <span className="typo-section-title" style={{ color: 'white' }}>Reifendruck (bar)</span>
             <button onClick={() => hc('profile.isTwinTires', !state.profile.isTwinTires)} className="typo-label transition-colors" style={{ color: state.profile.isTwinTires ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)' }}>+ ZWILLING</button>
          </div>
          
          <select value={activeTireProfile} onChange={e => setActiveTireProfile(e.target.value as any)} className="input-standard w-full">
              {TIRE_PROFILES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          
          <div className="grid grid-cols-2 gap-4 pt-2 relative">
             <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--border)] -translate-x-1/2"/>
             <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--border)] -translate-y-1/2"/>
             
             {/* FRONT LEFT */}
             <div className="flex flex-col items-center z-10 bg-[var(--bg-card)] py-1">
                 <span className="typo-label mb-1">VL {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                 <input type="number" step="0.1" value={tp.frontLeft} onChange={e => hc(`profile.tires.${activeTireProfile}.frontLeft`, parseFloat(e.target.value))} className={`input-standard w-16 text-center ${!tp.frontLeft ? 'animate-pulse-border text-[var(--text-muted)]' : ''}`} />
             </div>
             {/* FRONT RIGHT */}
             <div className="flex flex-col items-center z-10 bg-[var(--bg-card)] py-1">
                 <span className="typo-label mb-1">VR {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                 <input type="number" step="0.1" value={tp.frontRight} onChange={e => hc(`profile.tires.${activeTireProfile}.frontRight`, parseFloat(e.target.value))} className={`input-standard w-16 text-center ${!tp.frontRight ? 'animate-pulse-border text-[var(--text-muted)]' : ''}`} />
             </div>
             {/* REAR LEFT */}
             <div className="flex flex-col items-center z-10 bg-[var(--bg-card)] py-1">
                 <span className="typo-label mb-1">HL {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                 <input type="number" step="0.1" value={tp.rearLeft} onChange={e => hc(`profile.tires.${activeTireProfile}.rearLeft`, parseFloat(e.target.value))} className={`input-standard w-16 text-center ${!tp.rearLeft ? 'animate-pulse-border text-[var(--text-muted)]' : ''}`} />
                 {state.profile.isTwinTires && (
                    <>
                        <span className="typo-label mb-1 mt-2">HL (Außen)</span>
                        <input type="number" step="0.1" value={tp.rearLeftOuter || tp.rearLeft} onChange={e => hc(`profile.tires.${activeTireProfile}.rearLeftOuter`, parseFloat(e.target.value))} className={`input-standard w-16 text-center ${!(tp.rearLeftOuter || tp.rearLeft) ? 'animate-pulse-border text-[var(--text-muted)]' : ''}`} style={ (tp.rearLeftOuter || tp.rearLeft) ? { color: 'var(--accent)', borderColor: 'var(--border-strong)'} : {}} />
                    </>
                 )}
             </div>
             {/* REAR RIGHT */}
             <div className="flex flex-col items-center z-10 bg-[var(--bg-card)] py-1">
                 <span className="typo-label mb-1">HR {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                 <input type="number" step="0.1" value={tp.rearRight} onChange={e => hc(`profile.tires.${activeTireProfile}.rearRight`, parseFloat(e.target.value))} className={`input-standard w-16 text-center ${!tp.rearRight ? 'animate-pulse-border text-[var(--text-muted)]' : ''}`} />
                 {state.profile.isTwinTires && (
                    <>
                        <span className="typo-label mb-1 mt-2">HR (Außen)</span>
                        <input type="number" step="0.1" value={tp.rearRightOuter || tp.rearRight} onChange={e => hc(`profile.tires.${activeTireProfile}.rearRightOuter`, parseFloat(e.target.value))} className={`input-standard w-16 text-center ${!(tp.rearRightOuter || tp.rearRight) ? 'animate-pulse-border text-[var(--text-muted)]' : ''}`} style={ (tp.rearRightOuter || tp.rearRight) ? { color: 'var(--accent)', borderColor: 'var(--border-strong)'} : {}} />
                    </>
                 )}
             </div>
          </div>
      </div>

      {/* 
      <div className="flex flex-col gap-3 pt-6">
        <button onClick={demoSeed} className="w-full bg-blue-500 text-white py-4 rounded typo-label shadow-lg">Demo Reset</button>
        <button onClick={() => { if(confirm("LÖSCHEN?")) { initDB().then(db=>db.clear('store')); window.location.reload(); } }} className="w-full bg-red-600 text-white py-4 rounded typo-label shadow-lg">Full Wipe</button>
      </div>
      */}

      <AnimatePresence>
          {showFaqModal && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4">
                 <div className="flex justify-between items-center mb-6 pt-4"><h2 className="typo-section-title">FAQ</h2><button onClick={()=>setShowFaqModal(false)} className="btn-secondary px-3 py-1">X</button></div>
                 <div className="relative mb-4">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={14} />
                     <input type="text" placeholder="FAQ DURCHSUCHEN..." className="input-standard w-full pl-10 pr-4" value={faqSearch} onChange={(e) => setFaqSearch(e.target.value)} />
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                     {faqData.filter(f => f.q.toLowerCase().includes(faqSearch.toLowerCase()) || f.a.toLowerCase().includes(faqSearch.toLowerCase())).map((f:any, i:number) => (
                         <div key={i} className="card-standard space-y-3 relative">
                             <div className="w-full typo-card-title !mb-0">{f.q}</div>
                             <div className="w-full typo-body-dim">{f.a}</div>
                         </div>
                     ))}
                 </div>
             </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
