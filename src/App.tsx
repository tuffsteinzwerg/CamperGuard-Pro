import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, Settings, Map as MapIcon, BookOpen, Package, Activity, 
  Plus, Trash2, ChevronRight, Search, AlertTriangle,
  FileDown, ChevronDown, ChevronUp, Printer, MapPin, Archive, CheckCircle, Check,
  ShieldPlus, Phone, Edit2, User, Droplet, HeartPulse, Pill, Fuel, Flame,
  ArrowLeftRight, ArrowUpDown, Weight, Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './lib/setupLeafletIcons';
import { openDB } from 'idb';
import { INITIAL_STATE, AppState, InventoryItem, FuelEntry, TripEntry, FuelType, Currency, TireProfile, SpotEntry, FAQEntry, EmergencyGear, PharmacyItem } from './types.ts';
import { calculateAverageFuelConsumptionFromFuelLog, calculateFuelLogStats } from './lib/fuelCalculator';
import { formatNumber, formatWeight, normalizeGearName } from './lib/formatters';
import { NavButton } from './components/NavButton';
import { PrintHeader } from './print/PrintHeader';
import { InhaltPrintView } from './print/InhaltPrintView';
import { StatusView } from './views/StatusView';
import { ProfilView } from './views/ProfilView';
import { CHANGELOG } from './data/changelog';

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



export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'inhalt' | 'logbuch' | 'reise' | 'profil'>('status');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [orientation, setOrientation] = useState({ pitch: 0, roll: 0, heading: 0 });
  const [showChangelog, setShowChangelog] = useState(false);

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
           if ('iceName' in loadedSos) {
             loadedSos.ice1Name = loadedSos.iceName || "";
             loadedSos.ice1Phone = loadedSos.icePhone || "";
             delete loadedSos.iceName;
             delete loadedSos.icePhone;
           }
           
           // Ensure all new fields have defaults
           ['address', 'houseNumber', 'zipCode', 'city', 'country', 'ice2Name', 'ice2Phone', 'medications'].forEach(k => {
              if (loadedSos[k] === undefined) loadedSos[k] = "";
           });

           if (!Array.isArray(loadedSos.deletedGear)) {
               loadedSos.deletedGear = [];
           }

           if (loadedSos.gear) {
               const groupedGear: Record<string, any> = {};
               
               loadedSos.gear.forEach((g: any) => {
                   const migrated = { ...g };
                   migrated.name = normalizeGearName(migrated.name || '');
                   
                   if (migrated.count === undefined) {
                       migrated.count = migrated.checked ? 1 : 0;
                   }
                   
                   let locs: string[] = [];
                   if (Array.isArray(migrated.locations)) {
                       migrated.locations.forEach((l: any) => locs.push(String(l).trim()));
                   }
                   if (typeof migrated.location === 'string') {
                       locs.push(migrated.location.trim());
                   }
                   delete migrated.location;
                   
                   migrated.locations = Array.from(new Set(locs.filter(Boolean)));
                   
                   const key = migrated.name.toLowerCase();
                   if (!groupedGear[key]) {
                       groupedGear[key] = { ...migrated };
                   } else {
                       const existing = groupedGear[key];
                       existing.checked = existing.checked || migrated.checked;
                       existing.count = Math.max(Number(existing.count) || 0, Number(migrated.count) || 0);
                       
                       const allLocs = [...(existing.locations || []), ...(migrated.locations || [])];
                       existing.locations = Array.from(new Set(allLocs.filter(Boolean)));
                       
                       const preserveField = (field: string) => {
                           if ((existing[field] === undefined || existing[field] === null || existing[field] === '') && migrated[field]) {
                               existing[field] = migrated[field];
                           }
                       };
                       
                       preserveField('weight');
                       preserveField('weightUnit');
                       preserveField('category');
                       preserveField('notes');
                       preserveField('expiry');
                       
                       existing.isHidden = (existing.isHidden === true && migrated.isHidden === true);
                       existing.isDeleted = (existing.isDeleted === true && migrated.isDeleted === true);
                   }
               });
               
               loadedSos.gear = Object.values(groupedGear);
               
               if (Array.isArray(loadedSos.deletedGear)) {
                   loadedSos.deletedGear = loadedSos.deletedGear.map((d: string) => normalizeGearName(d));
               } else {
                   loadedSos.deletedGear = [];
               }
               
               const requiredCategories = ['Feuerlöscher', 'Feuerlöschdecke', 'Warnweste', 'Erste-Hilfe-Kasten', 'Warndreieck'];
               requiredCategories.forEach((cat, idx) => {
                   if (!loadedSos.gear.some((g: any) => normalizeGearName(g.name) === cat) && !loadedSos.deletedGear.some((d: string) => normalizeGearName(d) === cat)) {
                       loadedSos.gear.push({
                           id: `g_new_${idx}_${Date.now()}`,
                           name: cat,
                           checked: false,
                           count: 0,
                           locations: [],
                           weight: '',
                           weightUnit: 'kg'
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

  // Unified orientation logic (Kompass-Fix: absolute heading + iOS Permission)
  const [orientationPermission, setOrientationPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  const requestOrientationPermission = async () => {
    try {
      // @ts-ignore - requestPermission existiert nur auf iOS 13+
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // @ts-ignore
        const permission = await DeviceOrientationEvent.requestPermission();
        setOrientationPermission(permission);
        if (permission === 'granted') {
          window.location.reload(); // Reload damit der useEffect die Events bekommt
        }
      }
    } catch (err) {
      console.warn("Orientation permission request failed:", err);
      setOrientationPermission('denied');
    }
  };

  useEffect(() => {
    // Prüfe ob iOS Permission nötig ist
    // @ts-ignore
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      setOrientationPermission('prompt'); // iOS: Permission nötig, aber noch nicht erteilt
    } else {
      setOrientationPermission('granted'); // Android/Desktop: keine Permission nötig
    }

    let lastUpdate = 0;
    let absoluteAvailable = false;

    const processOrientation = (e: DeviceOrientationEvent) => {
      try {
        const now = Date.now();
        if (now - lastUpdate < 50) return;
        lastUpdate = now;

        let h = 0;

        // Priorität 1: iOS webkitCompassHeading (echter Kompass-Heading, 0=Nord, im Uhrzeigersinn)
        // @ts-ignore
        if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
          // @ts-ignore
          h = e.webkitCompassHeading;
        } 
        // Priorität 2: alpha umrechnen (alpha steigt gegen Uhrzeigersinn, Kompass im Uhrzeigersinn)
        else if (e.alpha !== null && e.alpha !== undefined) {
          h = (360 - e.alpha) % 360;
        }

        setOrientation({ pitch: e.beta || 0, roll: e.gamma || 0, heading: h });
      } catch (err) {
        console.warn("DeviceOrientation handling error:", err);
      }
    };

    // Handler für deviceorientationabsolute (Android: echter Magnetometer-Bezug)
    const handleAbsolute = (e: DeviceOrientationEvent) => {
      absoluteAvailable = true;
      processOrientation(e);
    };

    // Handler für normales deviceorientation (iOS + Fallback)
    const handleRelative = (e: DeviceOrientationEvent) => {
      // Wenn absolute verfügbar ist, ignoriere das relative Event
      if (absoluteAvailable) return;
      processOrientation(e);
    };

    try {
      // Android Chrome: deviceorientationabsolute hat Vorrang (echter Kompass)
      // @ts-ignore
      window.addEventListener('deviceorientationabsolute', handleAbsolute, true);
      // iOS + Fallback: normales deviceorientation
      window.addEventListener('deviceorientation', handleRelative, true);
    } catch (err) {
      console.warn("Could not attach deviceorientation", err);
    }

    return () => {
      try {
        // @ts-ignore
        window.removeEventListener('deviceorientationabsolute', handleAbsolute, true);
        window.removeEventListener('deviceorientation', handleRelative, true);
      } catch (err) {}
    };
  }, []);

  const demoSeed = () => {
      setState(INITIAL_STATE);
      alert("Demo init gestartet.");
  };

  if (loading) return <div className="fixed inset-0 bg-[var(--bg-app)] z-[999]" />;

  return (
    <div className="min-h-screen pb-24 lg:max-w-none max-w-md mx-auto relative bg-[var(--bg-app)] text-white print:min-h-0 print:pb-0 print:max-w-none print:mx-0 print:w-full">
      
      <header className="h-[60px] px-4 bg-[var(--bg-input)] border-b-2 border-[var(--accent)] sticky top-0 z-40 flex justify-between items-center no-print overflow-hidden gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <ShieldCheck className="text-[var(--accent)]" size={20} />
          <span className="brand-title whitespace-nowrap">
            <span className="brand-big">C</span>amper<span className="brand-big">G</span>uard Pro
          </span>
        </div>
        <div className="flex items-center justify-end min-w-0 gap-3">
          <button onClick={() => setActiveTab('profil')} className="cg-master-button !p-2 !rounded flex-shrink-0">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main className="p-4 overflow-y-auto lg:max-w-6xl lg:mx-auto min-h-[80vh] print:p-0 print:overflow-visible print:min-h-0 print:h-auto print:max-w-none print:mx-0 print:w-full">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {activeTab === 'status' && <StatusView state={state} setState={setState} orientation={orientation} />}
            {activeTab === 'inhalt' && <InhaltView state={state} setState={setState} />}
            {activeTab === 'logbuch' && <LogbuchView state={state} setState={setState} />}
            {activeTab === 'reise' && <ReiseView state={state} setState={setState} orientation={orientation} orientationPermission={orientationPermission} requestOrientationPermission={requestOrientationPermission} />}
            {activeTab === 'profil' && <ProfilView state={state} setState={setState} demoSeed={demoSeed} />}
          </motion.div>
        </AnimatePresence>
        <div 
          className="mt-8 mb-4 text-center text-[10px] text-[var(--text-muted)] opacity-50 no-print cursor-pointer"
          onClick={() => setShowChangelog(true)}
        >
          CamperGuard Pro v0.1.4-dev
        </div>

        {showChangelog && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col p-4 no-print overflow-hidden items-center justify-center">
            <div className="bg-[var(--bg-app)] rounded-xl border border-[var(--border)] max-w-2xl w-full text-[12px] text-white flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-[var(--border)] flex justify-between items-center sticky top-0 z-10 bg-[var(--bg-card)] rounded-t-xl cg-master-card-small">
                 <div>
                   <h2 className="text-lg font-bold text-[var(--primary)] mb-1">CamperGuard Pro v0.1.4-dev</h2>
                   <p className="text-[var(--text-muted)] !mb-0">Stand: 08.05.2026</p>
                 </div>
                 <button 
                   className="cg-master-button px-4 py-2"
                   onClick={() => setShowChangelog(false)}
                 >
                   Schließen
                  </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {CHANGELOG.map((ver, vIdx) => (
                  <div key={vIdx}>
                    <h3 className={`font-bold mb-2 ${vIdx === 0 ? 'text-[var(--accent)]' : ''}`}>
                      Änderungen {ver.version}:
                    </h3>
                    <ul className="space-y-1 text-gray-300 mb-6">
                      {ver.entries.map((entry, eIdx) => (
                        <li key={eIdx}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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

// --- SUBVIEWS ---
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

  const [isAddingMainCategory, setIsAddingMainCategory] = useState(false);
  const [newMainCategoryName, setNewMainCategoryName] = useState("");
  const [deletingMainCategory, setDeletingMainCategory] = useState<string | null>(null);
  const [deletingMainCategoryError, setDeletingMainCategoryError] = useState<string | null>(null);
  const [showSortSubcategories, setShowSortSubcategories] = useState(false);

  const formatUnit = (u?: string) => {
    if (!u) return '';
    const lower = u.toLowerCase();
    if (lower === 'g' || lower === 'gr') return 'g';
    if (lower === 'stk' || lower === 'stück') return 'stk';
    if (lower === 'kg') return 'kg';
    if (lower === 'l' || lower === 'liter') return 'l';
    return u;
  };

  const moveSubcategory = (sub: string, direction: "up" | "down") => {
    const currentSubs = state.subcategories[activeCategory] || [];
    const index = currentSubs.indexOf(sub);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === currentSubs.length - 1) return;

    const newSubs = [...currentSubs];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newSubs[index], newSubs[targetIndex]] = [newSubs[targetIndex], newSubs[index]];

    setState({
      ...state,
      subcategories: {
        ...state.subcategories,
        [activeCategory]: newSubs
      }
    });
  };

  const fixedCategories = ["Küche", "Wohnen", "Bad", "Garage", "Technik"];
  const customCategories = Object.keys(state.subcategories || {}).filter(k => !fixedCategories.includes(k));
  const categories = [...fixedCategories, ...customCategories];

  const searchedItems = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    
    const inventoryResults = state.inventory.filter((item: any) => 
        (item.name && item.name.toLowerCase().includes(term)) || 
        (item.subcategory && item.subcategory.toLowerCase().includes(term)) ||
        (item.category && item.category.toLowerCase().includes(term))
    );

    const gearResults = (state.sos?.gear || [])
        .filter((g: any) => 
            g.checked === true && Number(g.count) > 0 && g.isHidden !== true && g.isDeleted !== true &&
            ((g.name && g.name.toLowerCase().includes(term)) ||
            (g.locations && g.locations.some((l: string) => l.toLowerCase().includes(term))) ||
            "notfall-ausrüstung".includes(term) ||
            "safety hub".includes(term))
        )
        .map((g: any) => ({
            id: `sos-gear-${g.id}`,
            name: g.name,
            category: "Safety Hub",
            subcategory: (g.locations && g.locations.length > 0 && g.locations[0]) ? g.locations[0] : "Notfall-Ausrüstung",
            quantity: g.count,
            unit: "stk",
            weight: g.weight,
            weightUnit: g.weightUnit || "kg",
            sourceType: "safety-gear"
        }));

    const pharmacyResults = (state.sos?.pharmacy || [])
        .filter((p: any) => {
            if (!p) return false;
            const pName = String(p.name || '');
            const pPurpose = String(p.purpose || '');
            const pLoc = String(p.location || '');
            const pUnit = String(p.unit || '');
            
            return pName.trim() !== '' && p.isHidden !== true && p.isDeleted !== true &&
            (pName.toLowerCase().includes(term) ||
            pPurpose.toLowerCase().includes(term) ||
            pLoc.toLowerCase().includes(term) ||
            pUnit.toLowerCase().includes(term) ||
            "apotheke".includes(term) ||
            "safety hub".includes(term));
        })
        .map((p: any) => ({
            id: `sos-pharmacy-${p.id}`,
            name: p.name,
            category: "Safety Hub",
            subcategory: p.location || "Apotheke",
            quantity: p.quantity,
            unit: p.unit,
            weight: p.weight,
            weightUnit: p.weightUnit || "kg",
            sourceType: "safety-pharmacy"
        }));

    return [...inventoryResults, ...gearResults, ...pharmacyResults];
  }, [state.inventory, state.sos, searchTerm]);

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
          <button onClick={() => window.print()} className="cg-master-button !py-1.5 !px-3"><Printer size={14}/></button>
      </div>

      <div className="relative no-print mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
        <input type="text" placeholder="Bestand durchsuchen..." className="cg-master-input w-full !pl-[34px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="no-print pb-4 flex gap-2">
          <select 
              value={activeCategory} 
              onChange={e => {
                  if (e.target.value === '__sort__') {
                      setShowSortSubcategories(true);
                  } else {
                      setActiveCategory(e.target.value);
                  }
              }} 
              className="cg-master-input flex-1"
          >
              {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-[var(--bg-card)] text-white">{cat}</option>
              ))}
              <option disabled className="bg-[var(--bg-card)] text-white/50" value="__divider__">──────────</option>
              <option value="__sort__" className="bg-[var(--bg-card)] text-[var(--accent)]">Lagerorte in „{activeCategory}“ sortieren</option>
          </select>
          <button onClick={() => setIsAddingMainCategory(true)} className="cg-master-button !py-1.5 !px-3"><Plus size={14} /></button>
          {!fixedCategories.includes(activeCategory) && (
              <button 
                  onClick={() => {
                      const hasSubcats = (state.subcategories[activeCategory] || []).length > 0;
                      const hasItems = state.inventory.some((i: any) => i.category === activeCategory);
                      if (hasSubcats || hasItems) {
                          setDeletingMainCategoryError("Dieser Bereich kann erst gelöscht werden, wenn er leer ist.");
                      } else {
                          setDeletingMainCategory(activeCategory);
                      }
                  }} 
                  className="cg-master-button px-3 text-red-500"
              >
                  <Trash2 size={16}/>
              </button>
          )}
      </div>

      <div className="no-print">
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
                              <div key={item.id} className={`cg-master-card-small flex items-center justify-between ${item.quantity === 0 ? '!border-[var(--status-danger)]' : ''}`}>
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
                                      <span className={`typo-value-normal ${item.quantity === 0 ? 'cg-master-muted' : ''}`}>{item.quantity}</span>
                                      <span className="typo-value-small ml-1">{formatUnit(item.unit)}</span>
                                  </div>
                                  <div className="flex justify-end items-center gap-3 no-print flex-shrink-0 w-16">
                                      {!item.sourceType && (
                                          <>
                                              <button onClick={() => { setActiveCategory(item.category); setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory }); setEditingItem(item); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
                                              <button onClick={() => setDeletingItem(item)} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14} /></button>
                                          </>
                                      )}
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
                      className="cg-master-card-small flex justify-between items-center cursor-pointer select-none"
                      onClick={() => setActiveAccordion(activeAccordion === sub ? null : sub)}
                  >
                      <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                          <h3 className="typo-section-title min-w-0 flex-1 line-clamp-2" style={{ color: 'var(--accent)', marginBottom: 0, minHeight: '32px' }}>{sub}</h3>
                          <span className="typo-value-small whitespace-nowrap mt-0.5">
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
                                  return `${Math.round(totalKg)} kg`;
                              })()}
                          </span>
                      </div>
                      <div className="flex items-center gap-2 no-print shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditingSub({old: sub, new: sub})} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
                          <button onClick={() => setDeletingSub(sub)} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14} /></button>
                      </div>
                  </div>
                  {activeAccordion === sub && (
                      <div className="w-full mb-4 space-y-3 mt-3">
                          {(groupedBySub[sub] || []).map((item:any) => (
                              <div key={item.id} className={`cg-master-card-small flex items-center justify-between ${item.quantity === 0 ? '!border-[var(--status-danger)]' : ''}`}>
                                  <div className="flex-1">
                                      <div className="typo-card-title">{item.name}</div>
                                      {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) && (
                                          <div className="typo-body-dim !mb-0">
                                              {item.weight} {formatUnit(item.weightUnit)}
                                          </div>
                                      )}
                                  </div>
                                  <div className="text-right flex-shrink-0 mx-4">
                                      <span className={`typo-value-normal ${item.quantity === 0 ? 'cg-master-muted' : ''}`}>{item.quantity}</span>
                                      <span className="typo-value-small ml-1">{formatUnit(item.unit)}</span>
                                  </div>
                                  <div className="flex justify-end items-center gap-3 no-print flex-shrink-0 w-16">
                                      <button onClick={() => { setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory }); setEditingItem(item); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
                                      <button onClick={() => setDeletingItem(item)} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14} /></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          ))}
          </div>
      )}
      </div>

      <InhaltPrintView state={state} />

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none px-4 flex items-center justify-center gap-3 z-40 no-print">
          <button onClick={() => setIsAddingSub(true)} className="cg-master-button rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Lagerort</button>
          <button onClick={() => { setItemForm({ name: '', quantity: '1', unit: 'stk', weight: '', weightUnit: 'kg', subcategory: '' }); setIsAddingItem(true); }} className="cg-master-button rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Artikel</button>
      </div>

      <AnimatePresence>
        {isAddingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
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
                            <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Name" className="cg-master-input w-full" />
                            <div className="flex gap-3">
                                <input required type="number" step={formatUnit(itemForm.unit) === 'stk' ? "1" : "0.01"} min={formatUnit(itemForm.unit) === 'stk' ? "1" : "0"} value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} placeholder="Menge" className="cg-master-input w-24" />
                                <select value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="cg-master-input w-24">
                                    <option value="stk">stk</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <input type="number" step="0.01" min="0" value={itemForm.weight} onChange={e => setItemForm({...itemForm, weight: e.target.value})} placeholder="Gewicht pro Stk/Einheit (opt)" className="cg-master-input w-24" />
                                <select value={itemForm.weightUnit} onChange={e => setItemForm({...itemForm, weightUnit: e.target.value})} className="cg-master-input w-24">
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                </select>
                            </div>
                            <select required value={itemForm.subcategory} onChange={e => setItemForm({...itemForm, subcategory: e.target.value})} className="cg-master-input w-full">
                                <option value="" disabled>Lagerort wählen...</option>
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6"><button type="button" onClick={() => setIsAddingItem(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button><button type="submit" className="cg-master-button flex-1 !p-3">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
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
                            <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Name" className="cg-master-input w-full" />
                            <div className="flex gap-3">
                                <input required type="number" step={formatUnit(itemForm.unit) === 'stk' ? "1" : "0.01"} min={formatUnit(itemForm.unit) === 'stk' ? "1" : "0"} value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} placeholder="Menge" className="cg-master-input w-24" />
                                <select value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="cg-master-input w-24">
                                    <option value="stk">stk</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <input type="number" step="0.01" min="0" value={itemForm.weight} onChange={e => setItemForm({...itemForm, weight: e.target.value})} placeholder="Gewicht pro Stk/Einheit (opt)" className="cg-master-input w-24" />
                                <select value={itemForm.weightUnit} onChange={e => setItemForm({...itemForm, weightUnit: e.target.value})} className="cg-master-input w-24">
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                </select>
                            </div>
                            <select required value={itemForm.subcategory} onChange={e => setItemForm({...itemForm, subcategory: e.target.value})} className="cg-master-input w-full">
                                <option value="" disabled>Lagerort wählen...</option>
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setEditingItem(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                            <button type="submit" className="cg-master-button flex-1 !p-3">Speichern</button>
                        </div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Artikel löschen</h2>
                    <p className="typo-body">Willst du <strong>{deletingItem.name}</strong> wirklich aus dem Inhalt entfernen?</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingItem(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const newInv = state.inventory.filter((i:any) => i.id !== deletingItem.id);
                            setState({...state, inventory: newInv});
                            setDeletingItem(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Lagerort</h2>
                    <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Name" className="cg-master-input w-full" />
                    <div className="flex gap-3 mt-6"><button onClick={() => setIsAddingSub(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button><button onClick={() => { if(newSubName){ setState({...state, subcategories: {...state.subcategories, [activeCategory]: Array.from(new Set([...(state.subcategories[activeCategory]||[]), newSubName]))}}); setNewSubName(""); setIsAddingSub(false); } }} className="cg-master-button flex-1 !p-3">Speichern</button></div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Lagerort umbenennen</h2>
                    <input value={editingSub.new} onChange={e => setEditingSub({...editingSub, new: e.target.value})} placeholder="Neuer Name" className="cg-master-input w-full" />
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setEditingSub(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            if(editingSub.new && editingSub.new !== editingSub.old) {
                                const newSubs = Array.from(new Set((state.subcategories[activeCategory]||[]).map((s:string) => s === editingSub.old ? editingSub.new : s)));
                                const newInv = state.inventory.map((i:any) => i.category === activeCategory && i.subcategory === editingSub.old ? { ...i, subcategory: editingSub.new } : i);
                                setState({...state, subcategories: {...state.subcategories, [activeCategory]: newSubs}, inventory: newInv});
                            }
                            setEditingSub(null);
                        }} className="cg-master-button flex-1 !p-3">Speichern</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Lagerort löschen</h2>
                    <p className="typo-body">Willst du den Lagerort <strong>{deletingSub}</strong> wirklich löschen? Alle {(groupedBySub[deletingSub] || []).length} Artikel darin werden ebenfalls entfernt!</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingSub(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const newSubs = (state.subcategories[activeCategory]||[]).filter((s:string) => s !== deletingSub);
                            const newInv = state.inventory.filter((i:any) => !(i.category === activeCategory && i.subcategory === deletingSub));
                            setState({...state, subcategories: {...state.subcategories, [activeCategory]: newSubs}, inventory: newInv});
                            setDeletingSub(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingMainCategory && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Hauptbereich</h2>
                    <input value={newMainCategoryName} onChange={e => setNewMainCategoryName(e.target.value)} placeholder="Name" className="cg-master-input w-full" />
                    <div className="flex gap-3 mt-6"><button onClick={() => setIsAddingMainCategory(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                    <button onClick={() => { 
                        if(newMainCategoryName && !categories.includes(newMainCategoryName)){ 
                            setState({...state, subcategories: {...state.subcategories, [newMainCategoryName]: []}}); 
                            setActiveCategory(newMainCategoryName);
                            setNewMainCategoryName(""); 
                            setIsAddingMainCategory(false); 
                        } 
                    }} className="cg-master-button flex-1 !p-3">Speichern</button></div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingMainCategory && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Bereich löschen</h2>
                    <p className="typo-body">Willst du diesen Bereich wirklich löschen?</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingMainCategory(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const newSubs = { ...state.subcategories };
                            delete newSubs[deletingMainCategory];
                            setState({...state, subcategories: newSubs});
                            setActiveCategory("Küche");
                            setDeletingMainCategory(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingMainCategoryError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Fehler</h2>
                    <p className="typo-body">{deletingMainCategoryError}</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingMainCategoryError(null)} className="cg-master-button flex-1 !p-3">OK</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSortSubcategories && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm max-h-[80vh] flex flex-col">
                    <h2 className="typo-section-title mb-4">Lagerorte in „{activeCategory}“ sortieren</h2>
                    <div className="overflow-y-auto flex-1 space-y-2 mb-4 pr-1">
                        {(!state.subcategories[activeCategory] || state.subcategories[activeCategory].length === 0) ? (
                            <p className="typo-body">Keine Lagerorte vorhanden.</p>
                        ) : (
                            state.subcategories[activeCategory].map((sub: string, index: number, arr: string[]) => (
                                <div key={sub} className="cg-master-card-small !p-3 flex justify-between items-center bg-[var(--bg-card)]">
                                    <span className="typo-body font-medium truncate pr-2" title={sub}>{sub}</span>
                                    <div className="flex gap-1 shrink-0">
                                        <button 
                                            onClick={() => moveSubcategory(sub, "up")} 
                                            disabled={index === 0}
                                            className={`cg-master-button !p-2 !rounded bg-white/10 hover:bg-white/20 transition-colors border border-white/10 ${index === 0 ? 'opacity-25 cursor-not-allowed' : 'opacity-100'}`}
                                            title="nach oben"
                                        >
                                            <ChevronUp size={20} className="text-white drop-shadow-sm" strokeWidth={2.5} />
                                        </button>
                                        <button 
                                            onClick={() => moveSubcategory(sub, "down")} 
                                            disabled={index === arr.length - 1}
                                            className={`cg-master-button !p-2 !rounded bg-white/10 hover:bg-white/20 transition-colors border border-white/10 ${index === arr.length - 1 ? 'opacity-25 cursor-not-allowed' : 'opacity-100'}`}
                                            title="nach unten"
                                        >
                                            <ChevronDown size={20} className="text-white drop-shadow-sm" strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex gap-3 mt-auto shrink-0">
                        <button onClick={() => setShowSortSubcategories(false)} className="cg-master-button flex-1 !p-3">Fertig</button>
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

  const result = calculateAverageFuelConsumptionFromFuelLog(currentFuelLog);

  const [tankForm, setTankForm] = useState({ date: new Date().toISOString().split('T')[0], km: '', liters: '', price: '', total: '' });
  const [tripForm, setTripForm] = useState({ date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', destination: '', purpose: '', category: '', note: '' });
  const [businessTripForm, setBusinessTripForm] = useState({ date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', driver: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: '' });
  const [spotForm, setSpotForm] = useState({ date: new Date().toISOString().split('T')[0], name: '', lat: '', lng: '', note: '', category: 'Stellplatz' });
  const [spotGpsError, setSpotGpsError] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  const [tripGpsCoords, setTripGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [tripGpsStatus, setTripGpsStatus] = useState<'offline'|'loading'|'active'>('offline');
  
  const [focusedTankField, setFocusedTankField] = useState<string | null>(null);
  
  const [displayedTripsCount, setDisplayedTripsCount] = useState(5);
  const [displayedBusinessTripsCount, setDisplayedBusinessTripsCount] = useState(10);
  const [isConfirmingBusinessTrip, setIsConfirmingBusinessTrip] = useState(false);

  const getLastKnownKm = (): number => {
    let highestKm = 0;
    (state.fuelLog || []).forEach((e:any) => highestKm = Math.max(highestKm, Number(e.km) || 0));
    (state.tripLog || []).forEach((e:any) => highestKm = Math.max(highestKm, Number(e.toKm) || 0));
    (state.businessTripLog || []).forEach((e:any) => highestKm = Math.max(highestKm, Number(e.toKm) || 0));
    return highestKm;
  };

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

  useEffect(() => {
    if (!(isAdding && logType === 'fahrt' && tripLogMode === 'flex' && !editingTripId && state.sos?.gpsEnabled !== false)) {
      setTripGpsCoords(null);
      setTripGpsStatus('offline');
      return;
    }

    setTripGpsStatus('loading');

    navigator.geolocation.getCurrentPosition(
      p => {
        setTripGpsCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setTripGpsStatus('active');
      },
      () => {
        setTripGpsCoords(null);
        setTripGpsStatus('offline');
      },
      { enableHighAccuracy: true }
    );
  }, [isAdding, logType, tripLogMode, editingTripId, state.sos?.gpsEnabled]);

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

  const parsedLiters = parseFloat(tankForm.liters);
  const isLitersValid = tankForm.liters === '' || (!isNaN(parsedLiters) && parsedLiters > 0 && parsedLiters <= 9999);

  const parsedPrice = parseFloat(tankForm.price);
  const isPriceValid = tankForm.price === '' || (!isNaN(parsedPrice) && parsedPrice > 0 && parsedPrice <= 999);

  const parsedTripKm = parseFloat(tripForm.fromKm);
  const isTripValid = tripForm.fromKm !== '' && !isNaN(parsedTripKm) && parsedTripKm >= getLastKnownKm();
  const isBusinessTripValid = businessTripForm.fromKm !== '' && businessTripForm.toKm !== '' && parseFloat(businessTripForm.toKm) >= parseFloat(businessTripForm.fromKm) && parseFloat(businessTripForm.fromKm) >= 0 && parseFloat(businessTripForm.toKm) <= 999999 && parseFloat(businessTripForm.fromKm) <= 999999;
  const isBusinessTripPurposeValid = businessTripForm.purpose.length <= 50;
  const isBusinessTripDriverValid = businessTripForm.driver.trim() !== '';
  const isBusinessTripCategoryValid = businessTripForm.category.trim() !== '';
  const isBusinessTripToday = businessTripForm.date === new Date().toISOString().split('T')[0];

  const handleTankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let filteredValue = value;
    if (name === 'liters' || name === 'price' || name === 'total' || name === 'km') {
        filteredValue = filteredValue.replace(/-/g, '');
    }

    if (name === 'liters') {
        const parts = filteredValue.split('.');
        if (parts[0].length > 4) {
            parts[0] = parts[0].slice(0, 4);
            filteredValue = parts.join('.');
        }
    } else if (name === 'price') {
        const parts = filteredValue.split('.');
        if (parts[0].length > 3) {
            parts[0] = parts[0].slice(0, 3);
            filteredValue = parts.join('.');
        }
    }

    let newForm = { ...tankForm, [name]: filteredValue };
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

  const fuelStats = calculateFuelLogStats(state.fuelLog);

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
      <div className="flex justify-between items-end mb-4 px-2 no-print">
          <h1 className="cg-type-page-title">Logbuch {currentYear}</h1>
          <button onClick={() => window.print()} className="cg-master-button !py-1.5 !px-3"><Printer size={14}/></button>
      </div>

      <div className="cg-master-inset p-3 flex justify-between items-center sticky top-[-10px] z-20">
          <div className="text-center">
              <div className="cg-type-label">Jahres-KM</div>
              <div className="cg-type-value-large">{formatNumber(totalKm, 0)}</div>
          </div>
          <div className="text-center">
              <div className="cg-type-label">Gesamtkosten</div>
              <div className="cg-type-value-large text-[var(--status-danger)]">{formatNumber(totalEur, 2)} €</div>
          </div>
          <div className="text-center">
              <div className="cg-type-label">Verbrauch</div>
              <div className="cg-type-value-large">{formatNumber(result?.consumption || 0, 1)} L</div>
          </div>
      </div>

      <div className="cg-master-inset cg-master-tabs p-1 overflow-x-auto hide-scrollbar">
      {['tank', 'fahrt', 'spots', 'archiv'].map(t => (
        <button key={t} onClick={() => setLogType(t as any)} className={`cg-master-tab cg-type-tab ${logType === t ? 'cg-master-tab-active' : ''}`}>{t === 'tank' ? 'Tanken' : t === 'spots' ? "POI's" : t === 'fahrt' ? 'Fahrten' : t}</button>
      ))}
  </div>

      {logType === 'tank' && (
          <div className="space-y-3">
            {currentFuelLog.map((entry:any) => {
                const totalLocal = entry.price * entry.liters;
                const totalEur = totalLocal / (entry.exchangeRateToEur || 1);
                return (
                    <div key={entry.id} className="cg-master-card-small !p-3 flex justify-between items-center border-l-2 !border-l-[var(--accent)] !mb-0">
                        <div className="flex flex-col items-start gap-1">
                            <span className="cg-type-meta">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                            <span className="cg-type-value">{formatNumber(entry.km, 0)} <span className="cg-type-label ml-0.5">KM</span></span>
                            <span className="cg-type-label text-[var(--accent)]">{entry.fuelType}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right flex flex-col justify-end">
                                <div className="flex items-end justify-end gap-2 pb-[2px]">
                                    <span className="cg-type-value block text-[var(--accent)]">{formatNumber(entry.liters, 1)}<span className="cg-type-label ml-0.5">L</span></span>
                                    <span className="cg-type-value block">{formatNumber(totalLocal, 2)} {entry.currency}</span>
                                </div>
                                <div className="cg-type-meta mt-[2px]">
                                    {formatNumber(entry.price, 2)} {entry.currency}/L 
                                    {entry.currency !== 'EUR' && <span className="ml-1 text-[var(--text-tertiary)]">({formatNumber(totalEur, 2)} €)</span>}
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    let proceed = true;
                                    try {
                                        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
                                            proceed = window.confirm('Möchtest du diesen Tankeintrag wirklich löschen?');
                                        }
                                    } catch (e) {
                                        proceed = true;
                                    }
                                    if(proceed) {
                                        setState({
                                            ...state, 
                                            fuelLog: state.fuelLog.filter((f:any) => {
                                                if (entry.id) {
                                                    return f.id !== entry.id;
                                                }
                                                return !(f.km === entry.km && f.liters === entry.liters && f.date === entry.date);
                                            })
                                        });
                                    }
                                }} 
                                className="cg-master-button-danger !p-2 !rounded flex-shrink-0 -mr-2"
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
              <div className="cg-master-inset cg-master-tabs p-1">
      <button onClick={() => setTripLogMode('flex')} className={`cg-master-tab cg-type-tab ${tripLogMode === 'flex' ? 'cg-master-tab-active' : ''}`}>REISETAGEBUCH</button>
      <button onClick={() => setTripLogMode('strict')} className={`cg-master-tab cg-type-tab ${tripLogMode === 'strict' ? 'cg-master-tab-active' : ''}`}>FAHRTENBUCH §</button>
  </div>

              {tripLogMode === 'flex' && (
                  <div className="space-y-3">
                      {currentTripLog.slice(0, displayedTripsCount).map((entry:any) => (
                          <div key={entry.id} className="cg-master-card-small !p-3 border-l-2 !border-l-[var(--accent)] !mb-0 overflow-hidden" style={{ maxHeight: '90px' }}>
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex flex-col gap-0 items-start w-2/3">
                                    <span className="cg-type-meta">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <h4 className="cg-type-card-title">{entry.destination}</h4>
                                    </div>
                                    {entry.purpose && <p className="cg-type-meta mt-0.5 break-words line-clamp-1 text-ellipsis overflow-hidden">{entry.purpose}</p>}
                                    {entry.note && <p className="cg-type-meta italic mt-0.5 break-words line-clamp-1 text-ellipsis overflow-hidden">{entry.note}</p>}
                                    {entry.lat && entry.lng && (
                                        <a 
                                            href={`https://www.google.com/maps?q=${entry.lat},${entry.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 mt-0.5 no-underline"
                                            style={{ textDecoration: 'none' }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MapPin size={10} className="text-[var(--accent)] shrink-0"/>
                                            <span className="cg-type-meta text-[var(--accent)]">{entry.lat.toFixed(4)}, {entry.lng.toFixed(4)}</span>
                                        </a>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-2 w-1/3">
                                    <div className="cg-type-value text-[var(--accent)]">
                                        +{(entry.toKm != null && entry.fromKm != null && !isNaN(entry.toKm) && !isNaN(entry.fromKm)) ? Number(entry.toKm - entry.fromKm).toLocaleString('de-DE') : (entry.toKm - entry.fromKm)} <span className="cg-type-label ml-0.5">KM</span>
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
                                                category: '',
                                                note: entry.note || ''
                                            });
                                            setIsAdding(true);
                                        }} className="cg-master-button !p-1 !rounded flex-shrink-0"><Edit2 size={14}/></button>
                                        <button onClick={() => {
                                            if(confirm('Möchtest du diesen Fahrten-Eintrag wirklich löschen?')) {
                                                setState({...state, tripLog: state.tripLog.filter((t:any) => t.id !== entry.id)});
                                            }
                                        }} className="cg-master-button-danger !p-1 !rounded flex-shrink-0 -mr-2"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                          </div>
                      ))}
                      {currentTripLog.length === 0 && <div className="text-center cg-type-meta mt-8">Keine Einträge</div>}
                      {currentTripLog.length > displayedTripsCount && (
                          <button onClick={() => setDisplayedTripsCount(c => c + 5)} className="cg-master-button w-full py-2 flex flex-row items-center justify-center gap-2">
                              Mehr anzeigen
                          </button>
                      )}
                  </div>
              )}

              {tripLogMode === 'strict' && (
                  <div className="space-y-3">
                      {currentBusinessTripLog.slice(0, displayedBusinessTripsCount).map((entry:any) => {
                          const isLocked = (Date.now() - parseInt(entry.id)) > 24 * 60 * 60 * 1000;
                          return (
                              <div key={entry.id} className={`cg-master-card-small !p-3 space-y-3 border-l-2 !mb-0 ${isLocked ? 'opacity-70' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-1 items-start w-2/3">
                                        <span className="cg-type-meta">{new Date(entry.date).toLocaleDateString('de-DE')} {isLocked && <span className="ml-1 text-[8px] px-1 uppercase tracking-wider border">Gesperrt</span>}</span>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <h4 className="cg-type-card-title">{entry.city ? `${entry.zip} ${entry.city}` : 'Unbekanntes Ziel'}</h4>
                                            <span className="cg-type-label border px-1">{entry.category || 'Dienstlich'}</span>
                                        </div>
                                        <p className="cg-type-meta mt-1">{entry.street} {entry.houseNumber}</p>
                                        <p className="cg-type-meta mt-1 break-words line-clamp-1">Fahrer: {entry.driver}</p>
                                        <p className="cg-type-meta mt-1 break-words line-clamp-2">Zweck: {entry.purpose || '-'}</p>
                                        {entry.businessPartner && <p className="cg-type-meta italic mt-0.5 break-words line-clamp-2">Partner: {entry.businessPartner}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-2 w-1/3">
                                        <div className="cg-type-value whitespace-nowrap">
                                            +{(entry.toKm != null && entry.fromKm != null && !isNaN(entry.toKm) && !isNaN(entry.fromKm)) ? Number(entry.toKm - entry.fromKm).toLocaleString('de-DE') : (entry.toKm - entry.fromKm)} <span className="cg-type-label ml-0.5">KM</span>
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
                                                        driver: entry.driver || '',
                                                        street: entry.street || '',
                                                        houseNumber: entry.houseNumber || '',
                                                        zip: entry.zip || '',
                                                        city: entry.city || '',
                                                        purpose: entry.purpose || '',
                                                        businessPartner: entry.businessPartner || '',
                                                        note: entry.note || ''
                                                    });
                                                    setIsAdding(true);
                                                }} className="cg-master-button !p-1 !rounded flex-shrink-0"><Edit2 size={14}/></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="cg-type-meta mt-2 pt-2 border-t border-[var(--border)] flex justify-between">
                                    <span>Start <span className="cg-type-value text-sm ml-1">{(entry.fromKm != null && !isNaN(entry.fromKm)) ? Number(entry.fromKm).toLocaleString('de-DE') : entry.fromKm}</span></span>
                                    <span>Ziel <span className="cg-type-value text-sm ml-1">{(entry.toKm != null && !isNaN(entry.toKm)) ? Number(entry.toKm).toLocaleString('de-DE') : entry.toKm}</span></span>
                                </div>
                              </div>
                          );
                      })}
                      {currentBusinessTripLog.length === 0 && <div className="text-center cg-type-meta mt-8">Keine Fahrtenbucheinträge</div>}
                      {currentBusinessTripLog.length > displayedBusinessTripsCount && (
                          <button onClick={() => setDisplayedBusinessTripsCount(c => c + 10)} className="cg-master-button w-full py-2 flex flex-row items-center justify-center gap-2">
                              Mehr anzeigen
                          </button>
                      )}
                  </div>
              )}
          </div>
      )}

      {logType === 'spots' && (
          <div className="space-y-3">
              <button onClick={downloadGPX} className="cg-master-button w-full py-2 mb-4 flex flex-row items-center justify-center gap-2"><FileDown size={14}/> GPX Export</button>
              {state.spots.map((spot:any) => (
                  <div key={spot.id} className="cg-master-card-small !p-3 relative border-l-2 !mb-0">
                      <div className="flex flex-col">
                         <div className="flex justify-between items-start">
                             <span className="cg-type-meta">{new Date(spot.date).toLocaleDateString('de-DE')}</span>
                             <div className="flex items-center gap-2">
                                <button onClick={() => { setSpotForm({ date: spot.date, name: spot.name, lat: spot.lat.toString(), lng: spot.lng.toString(), note: spot.note || '', category: spot.category || 'Stellplatz' }); setEditingSpotId(spot.id); setSpotGpsError(false); setIsAdding(true); }} className="cg-master-button !p-1 !rounded flex-shrink-0"><Edit2 size={12}/></button>
                                <button onClick={() => { if(confirm('Möchtest du diesen POI-Eintrag wirklich löschen?')) { setState({...state, spots: state.spots.filter((s:any) => s.id !== spot.id)}); } }} className="cg-master-button-danger !p-1 !rounded flex-shrink-0"><Trash2 size={12}/></button>
                             </div>
                         </div>
                         <div className="flex flex-wrap items-center gap-2 mt-1">
                            <h4 className="cg-type-card-title">{spot.name}</h4>
                            {spot.category && <span className="cg-type-label">{spot.category}</span>}
                         </div>
                         {spot.note && <p className="cg-type-meta mt-1 break-words line-clamp-2">{spot.note}</p>}
                         <a href={`geo:${spot.lat},${spot.lng}`} className="cg-master-button !py-1 !px-2 mt-2 inline-flex items-center gap-1 w-max"><MapPin size={12}/> {spot.lat.toFixed(4)} / {spot.lng.toFixed(4)}</a>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {logType === 'archiv' && (
          <div className="space-y-4">
              {state.archives.map((a:any) => (
                  <div key={a.year} className="cg-master-card-small !p-4 !mb-0">
                      <h3 className="cg-type-value-large flex items-center gap-2 pb-2 mb-2 border-b border-[var(--border)]"><Archive size={14}/> {a.year}</h3>
                      <div className="grid grid-cols-3 gap-2 text-center mt-3">
                          <div>
                              <div className="cg-type-label text-[var(--text-muted)]">Distanz</div>
                              <div className="cg-type-value">{formatNumber(a.totalKm, 0)} <span className="cg-type-label ml-0.5">KM</span></div>
                          </div>
                          <div>
                              <div className="cg-type-label text-[var(--text-muted)]">Liter</div>
                              <div className="cg-type-value">{formatNumber(a.totalLiters, 1)} <span className="cg-type-label ml-0.5">L</span></div>
                          </div>
                          <div>
                              <div className="cg-type-label text-[var(--text-muted)]">Kosten</div>
                              <div className="cg-type-value text-[var(--accent)]">{formatNumber(a.totalEur, 2)} <span className="cg-type-label ml-0.5">€</span></div>
                          </div>
                      </div>
                  </div>
              ))}
              {state.archives.length === 0 && <div className="text-center cg-type-meta py-8">Keine Archive</div>}
          </div>
      )}

      {(logType === 'tank' || logType === 'fahrt' || logType === 'spots') && (
          <div className="fixed bottom-24 right-4 z-40 flex items-center gap-3">
              {logType === 'tank' && (
                  <button onClick={closeYear} className="cg-master-button h-9 px-4 rounded-full flex flex-row items-center justify-center shadow-2xl border border-[var(--accent-dark)] gap-2">
                      <Archive size={14}/> <span className="text-xs font-bold">Abschließen</span>
                  </button>
              )}
              <button 
                onClick={() => { 
                    const highestKm = getLastKnownKm();
                    if (logType === 'tank') {
                        setTankForm(f => ({...f, date: new Date().toISOString().split('T')[0], km: highestKm > 0 ? highestKm.toString() : ''})); 
                    } else if (logType === 'fahrt') {
                        setTripForm(f => ({...f, date: new Date().toISOString().split('T')[0], fromKm: highestKm > 0 ? highestKm.toString() : '', toKm: '', destination: '', purpose: '', category: '', note: ''}));
                        setBusinessTripForm(f => ({...f, date: new Date().toISOString().split('T')[0], fromKm: highestKm > 0 ? highestKm.toString() : '', toKm: '', driver: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: ''}));
                    } else if (logType === 'spots') {
                        setSpotForm(f => ({...f, date: new Date().toISOString().split('T')[0], name: '', lat: '', lng: '', note: '', category: 'Stellplatz'}));
                        setSpotGpsError(false);
                    }
                    setEditingTripId(null);
                    setEditingSpotId(null);
                    setIsAdding(true); 
                }} 
                className="cg-master-button h-9 px-5 rounded-full flex flex-row items-center justify-center shadow-2xl border border-[var(--accent-dark)]"
              >
                <Plus size={20} />
              </button>
          </div>
      )}

      <AnimatePresence>
        {isAdding && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 overflow-y-auto">
                <div className="cg-master-card-small w-full max-w-sm my-8">
                    <h2 className="typo-section-title mb-4">{logType === 'tank' ? 'Tankbeleg' : logType === 'fahrt' ? (tripLogMode === 'strict' ? 'Fahrtenbuch' : 'Reise-Notiz') : "POI's Log"}</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const fd = new FormData(e.target);
                        if(logType === 'tank') {
                            const parsedLiters = parseFloat(tankForm.liters);
                            const parsedPrice = parseFloat(tankForm.price);
                            if (isNaN(parsedLiters) || parsedLiters <= 0) {
                                window.alert("Bitte einen gültigen Wert für Liter eingeben (größer als 0).");
                                return;
                            }
                            if (isNaN(parsedPrice) || parsedPrice <= 0) {
                                window.alert("Bitte einen gültigen Wert für Preis eingeben (größer als 0).");
                                return;
                            }
                            if (state.profile?.dieselCapacity && state.profile.dieselCapacity > 0) {
                                if (parsedLiters > state.profile.dieselCapacity) {
                                    window.alert("Die getankte Menge darf nicht größer sein als die Kraftstofftank-Kapazität im Profil.");
                                    return;
                                }
                            }
                            const cur = fd.get('currency') as Currency;
                            const rate = state.exchangeRates[cur] || 1;
                            const isVollgetankt = fd.get('vollgetankt') !== 'false';
                            const entry: FuelEntry = { id: Date.now().toString(), date: tankForm.date, km: parseFloat(tankForm.km), liters: parseFloat(tankForm.liters), price: parseFloat(tankForm.price), currency: cur, exchangeRateToEur: rate, fuelType: fd.get('fuelType') as FuelType, vollgetankt: isVollgetankt };
                            setState({...state, fuelLog: [entry, ...state.fuelLog]});
                            setIsAdding(false);
                        } else if(logType === 'fahrt') {
                            if (tripLogMode === 'strict') {
                                setIsConfirmingBusinessTrip(true);
                            } else {
                                const parsedToKm = parseFloat(tripForm.fromKm);
                                const entry: any = { 
                                    id: editingTripId || Date.now().toString(), 
                                    date: tripForm.date, 
                                    fromKm: editingTripId ? (state.tripLog.find((t:any) => t.id === editingTripId)?.fromKm ?? getLastKnownKm()) : getLastKnownKm(), 
                                    toKm: isNaN(parsedToKm) ? 0 : parsedToKm, 
                                    purpose: tripForm.purpose, 
                                    destination: tripForm.destination, 
                                    note: tripForm.note,
                                    lat: editingTripId ? (state.tripLog.find((t:any) => t.id === editingTripId)?.lat ?? undefined) : (tripGpsCoords?.lat || undefined),
                                    lng: editingTripId ? (state.tripLog.find((t:any) => t.id === editingTripId)?.lng ?? undefined) : (tripGpsCoords?.lng || undefined)
                                };
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
                            }} className="cg-master-input w-full" />
                            {logType === 'fahrt' && tripLogMode === 'strict' && !isBusinessTripToday && (
                                <span className="typo-tiny block mt-1 cg-master-muted">Fahrtenbuch-Einträge müssen am selben Tag erfasst werden.</span>
                            )}
                            
                            {logType === 'tank' ? (
                                <>
                                    <input name="km" required type={focusedTankField === 'km' ? "number" : "text"} min="0" placeholder="KM-Stand" value={focusedTankField === 'km' ? tankForm.km : (tankForm.km !== '' && !isNaN(parseFloat(tankForm.km)) ? parseFloat(tankForm.km).toLocaleString('de-DE', { maximumFractionDigits: 0 }) : tankForm.km)} onChange={handleTankChange} onFocus={() => setFocusedTankField('km')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className={`cg-master-input w-full`} />
                                    {!isKmValid && tankForm.km !== '' && (
                                        <span className="typo-tiny block mt-1 cg-master-muted">
                                            {maxKm === Infinity 
                                                ? `Kilometerstand muss mindestens ${formatNumber(minKm, 0)} km betragen.` 
                                                : minKm === 0 
                                                    ? `Kilometerstand darf höchstens ${formatNumber(maxKm, 0)} km betragen.`
                                                    : `Kilometerstand muss zwischen ${formatNumber(minKm, 0)} und ${formatNumber(maxKm, 0)} km liegen.`}
                                        </span>
                                    )}
                                    {isKmValid && tankForm.km !== '' && parseFloat(tankForm.km) < getLastKnownKm() && (
                                        <span className="typo-tiny block mt-1" style={{ color: 'var(--status-warn)' }}>Warnung: Kleiner als letzter KM-Stand ({formatNumber(getLastKnownKm(), 0)}).</span>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="w-full">
                                            <input name="liters" required type={focusedTankField === 'liters' ? "number" : "text"} min="0.01" step="0.01" max="9999" placeholder="Liter" value={focusedTankField === 'liters' ? tankForm.liters : (tankForm.liters !== '' && !isNaN(parseFloat(tankForm.liters)) ? parseFloat(tankForm.liters).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : tankForm.liters)} onChange={handleTankChange} onFocus={() => setFocusedTankField('liters')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className={`cg-master-input w-full`} />
                                            {!isLitersValid && tankForm.liters !== '' && <span className="typo-tiny block mt-1 cg-master-muted">Liter muss &gt; 0 und &lt;= 9999 sein.</span>}
                                        </div>
                                        <select name="fuelType" className="cg-master-select w-full">
                                            {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="w-full">
                                            <input name="price" required type={focusedTankField === 'price' ? "number" : "text"} min="0.01" step="0.001" max="999" placeholder="Preis/Liter" value={focusedTankField === 'price' ? tankForm.price : (tankForm.price !== '' && !isNaN(parseFloat(tankForm.price)) ? parseFloat(tankForm.price).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : tankForm.price)} onChange={handleTankChange} onFocus={() => setFocusedTankField('price')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className={`cg-master-input w-full`} />
                                            {!isPriceValid && tankForm.price !== '' && <span className="typo-tiny block mt-1 cg-master-muted">Preis muss &gt; 0 und &lt;= 999 sein.</span>}
                                        </div>
                                        <div className="w-full">
                                            <input name="total" type={focusedTankField === 'total' ? "number" : "text"} min="0" step="0.01" placeholder="Gesamtbetrag" value={focusedTankField === 'total' ? tankForm.total : (tankForm.total !== '' && !isNaN(parseFloat(tankForm.total)) ? parseFloat(tankForm.total).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : tankForm.total)} onChange={handleTankChange} onFocus={() => setFocusedTankField('total')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className="cg-master-input w-full" />
                                        </div>
                                    </div>
                                    <select name="currency" className="cg-master-select w-full mt-2">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <div className="mt-4">
                                        <label className="typo-label mb-2 block">Vollgetankt</label>
                                        <select name="vollgetankt" className="cg-master-select w-full" defaultValue="true">
                                            <option value="true">Ja</option>
                                            <option value="false">Nein</option>
                                        </select>
                                    </div>
                                </>
                            ) : logType === 'fahrt' ? (
                                tripLogMode === 'strict' ? (
                                    <>
                                        <select name="category" value={businessTripForm.category} onChange={e => setBusinessTripForm({...businessTripForm, category: e.target.value})} className="cg-master-input w-full">
                                            <option value="Dienstlich">Dienstlich</option>
                                            <option value="Privat">Privat</option>
                                            <option value="Betriebsstätte">Betriebsstätte</option>
                                        </select>
                                        <input name="driver" required placeholder="Fahrer" value={businessTripForm.driver} onChange={e => setBusinessTripForm({...businessTripForm, driver: e.target.value})} className={`cg-master-input w-full`} />
                                        {!isBusinessTripDriverValid && businessTripForm.driver === '' && <span className="typo-tiny block mt-1 cg-master-muted">Fahrer ist ein Pflichtfeld.</span>}
                                        <div className="flex gap-2">
                                            <input name="fromKm" required type="number" inputMode="numeric" pattern="[0-9]*" placeholder="Start KM" value={businessTripForm.fromKm} onChange={e => { const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6); setBusinessTripForm({...businessTripForm, fromKm: digitsOnly}); }} className={`cg-master-input w-1/2`} />
                                            <input name="toKm" required type="number" inputMode="numeric" pattern="[0-9]*" placeholder="Ziel KM" value={businessTripForm.toKm} onChange={e => { const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6); setBusinessTripForm({...businessTripForm, toKm: digitsOnly}); }} className={`cg-master-input w-1/2`} />
                                        </div>
                                        {businessTripForm.fromKm === '' && <span className="typo-tiny block mt-1 cg-master-muted">Start KM ist ein Pflichtfeld.</span>}
                                        {businessTripForm.toKm === '' && <span className="typo-tiny block mt-1 cg-master-muted">Ziel KM ist ein Pflichtfeld.</span>}
                                        {businessTripForm.fromKm !== '' && parseFloat(businessTripForm.fromKm) < getLastKnownKm() && <span className="typo-tiny block mt-1 cg-master-muted">Warnung: Start-KM kleiner als letzter KM-Stand ({formatNumber(getLastKnownKm(), 0)}).</span>}
                                        {!isBusinessTripValid && businessTripForm.toKm !== '' && <span className="typo-tiny block mt-1 cg-master-muted">Ziel KM muss größer als Start KM sein.</span>}
                                        <div className="flex gap-2">
                                            <input name="street" required placeholder="Straße" value={businessTripForm.street} onChange={e => setBusinessTripForm({...businessTripForm, street: e.target.value})} className="cg-master-input w-3/4" />
                                            <input name="houseNumber" required placeholder="Nr." value={businessTripForm.houseNumber} onChange={e => setBusinessTripForm({...businessTripForm, houseNumber: e.target.value})} className="cg-master-input w-1/4" />
                                        </div>
                                        <div className="flex gap-2">
                                            <input name="zip" required placeholder="PLZ" value={businessTripForm.zip} onChange={e => setBusinessTripForm({...businessTripForm, zip: e.target.value})} className="cg-master-input w-1/3" />
                                            <input name="city" required placeholder="Ort" value={businessTripForm.city} onChange={e => setBusinessTripForm({...businessTripForm, city: e.target.value})} className="cg-master-input w-2/3" />
                                        </div>
                                        <input name="purpose" maxLength={50} placeholder="Zweck (optional)" value={businessTripForm.purpose} onChange={e => setBusinessTripForm({...businessTripForm, purpose: e.target.value})} className={`cg-master-input w-full`} />
                                        {businessTripForm.category === 'Dienstlich' && (
                                            <input name="businessPartner" placeholder="Geschäftspartner (optional)" value={businessTripForm.businessPartner} onChange={e => setBusinessTripForm({...businessTripForm, businessPartner: e.target.value})} className="cg-master-input w-full" />
                                        )}
                                        <textarea name="note" placeholder="Notiz / Routenhinweis (optional)" value={businessTripForm.note} onChange={e => setBusinessTripForm({...businessTripForm, note: e.target.value})} className="cg-master-input w-full h-16" />
                                    </>
                                ) : (
                                    <>
                                        <input name="fromKm" required type="number" inputMode="numeric" pattern="[0-9]*" placeholder="Aktueller Tacho-Stand" value={tripForm.fromKm} onChange={e => { const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6); setTripForm({...tripForm, fromKm: digitsOnly}); }} className="cg-master-input w-full" />
                                        {tripForm.fromKm !== '' && parseFloat(tripForm.fromKm) < getLastKnownKm() && <span className="typo-tiny block mt-1 cg-master-muted">Warnung: Tacho-Stand kleiner als letzter KM-Stand ({formatNumber(getLastKnownKm(), 0)}).</span>}
                                        <input name="destination" required placeholder="Zielort" value={tripForm.destination} onChange={e => setTripForm({...tripForm, destination: e.target.value})} className="cg-master-input w-full" />
                                        <textarea name="note" placeholder="Notizen" value={tripForm.note} onChange={e => setTripForm({...tripForm, note: e.target.value})} className="cg-master-input w-full h-20" />
                                        {tripGpsCoords && tripGpsStatus === 'active' && !editingTripId && (
                                            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-[var(--bg-card)]">
                                                <MapPin size={14} className="text-[var(--accent)] shrink-0"/>
                                                <span className="cg-type-meta text-[var(--accent)]">GPS: {tripGpsCoords.lat.toFixed(5)}, {tripGpsCoords.lng.toFixed(5)}</span>
                                                <span className="cg-type-meta cg-master-muted ml-auto">wird gespeichert</span>
                                            </div>
                                        )}
                                        {editingTripId && (() => {
                                            const existingEntry = state.tripLog.find((t:any) => t.id === editingTripId);
                                            if (existingEntry?.lat && existingEntry?.lng) {
                                                return (
                                                    <a href={`https://www.google.com/maps?q=${existingEntry.lat},${existingEntry.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-[var(--bg-card)] no-underline" style={{ textDecoration: 'none' }}>
                                                        <MapPin size={14} className="text-[var(--accent)] shrink-0"/>
                                                        <span className="cg-type-meta text-[var(--accent)]">GPS: {existingEntry.lat.toFixed(5)}, {existingEntry.lng.toFixed(5)}</span>
                                                    </a>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </>
                                )
                            ) : (
                                <>
                                    <input name="name" required placeholder="POI Name" value={spotForm.name} onChange={e => setSpotForm({...spotForm, name: e.target.value})} className="cg-master-input w-full" />
                                    <select name="category" value={spotForm.category} onChange={e => setSpotForm({...spotForm, category: e.target.value})} className="cg-master-input w-full">
                                        <option value="Stellplatz">Stellplatz</option>
                                        <option value="Freistehen">Freistehen</option>
                                        <option value="Campingplatz">Campingplatz</option>
                                        <option value="Entsorgung">Entsorgung</option>
                                        <option value="Versorgung">Versorgung</option>
                                        <option value="Einkauf">Einkauf</option>
                                        <option value="Aussicht">Aussicht</option>
                                        <option value="Sonstiges">Sonstiges</option>
                                    </select>
                                    {spotGpsError && <span className="typo-tiny block mt-1 cg-master-muted">GPS nicht verfügbar</span>}
                                    <div className="flex gap-2 items-center">
                                        <button type="button" onClick={async () => {
                                            try { 
                                                const p = await getPosition(); 
                                                setSpotForm(s => ({...s, lat: p.lat.toString(), lng: p.lng.toString()})); 
                                                setSpotGpsError(false);
                                            } catch(err){ 
                                                setSpotGpsError(true);
                                            }
                                        }} className="cg-master-inset cg-master-control w-12 flex items-center justify-center rounded"><MapPin size={18}/></button>
                                        <input name="lat" required type="number" step="any" placeholder="Lat" value={spotForm.lat} onChange={e => setSpotForm({...spotForm, lat: e.target.value})} className="cg-master-input w-1/2" />
                                        <input name="lng" required type="number" step="any" placeholder="Lng" value={spotForm.lng} onChange={e => setSpotForm({...spotForm, lng: e.target.value})} className="cg-master-input w-1/2" />
                                    </div>
                                    <textarea name="note" placeholder="Notiz" value={spotForm.note} onChange={e => setSpotForm({...spotForm, note: e.target.value})} className="cg-master-input w-full h-24" />
                                </>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6"><button type="button" onClick={() => { setIsAdding(false); setEditingTripId(null); setEditingSpotId(null); setIsConfirmingBusinessTrip(false); }} className="cg-master-button flex-1 !p-3">Abbrechen</button><button type="submit" disabled={(logType === 'tank' && (!isKmValid || !isLitersValid || !isPriceValid)) || (logType === 'fahrt' && tripLogMode === 'flex' && !isTripValid) || (logType === 'fahrt' && tripLogMode === 'strict' && (!isBusinessTripValid || !isBusinessTripPurposeValid || !isBusinessTripDriverValid || !isBusinessTripCategoryValid || !isBusinessTripToday))} className="cg-master-button flex-1 py-3 disabled:opacity-50">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isConfirmingBusinessTrip && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm" style={{ borderColor: 'var(--accent)' }}>
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
                                driver: businessTripForm.driver,
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
                        }} className="cg-master-button w-full py-3">Verbindlich speichern</button>
                        <button onClick={() => setIsConfirmingBusinessTrip(false)} className="cg-master-button w-full py-3">Zurück zur Prüfung</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      </div>

      <div className="hidden print-only logbuch-print-wrapper bg-white">
          <PrintHeader 
              title={logType === 'tank' ? 'Tankprotokoll' : logType === 'fahrt' ? (tripLogMode === 'strict' ? 'Fahrtenbuch §' : 'Reisetagebuch') : logType === 'spots' ? "Standorte / POI" : 'Archiv'} 
              vehicleName={state.profile?.vehicleName} 
          />

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
                 <thead><tr><th>Datum</th><th>Zielort</th><th>Zweck</th><th>Start KM</th><th>Ziel KM</th><th>Strecke</th><th>Notiz</th></tr></thead>
                 <tbody>
                     {currentTripLog.map((t:any) => (
                         <tr key={t.id}>
                             <td>{new Date(t.date).toLocaleDateString('de-DE')}</td>
                             <td>{t.destination}</td>
                             <td>{t.purpose}</td>
                             <td>{(t.fromKm != null && !isNaN(t.fromKm)) ? Number(t.fromKm).toLocaleString('de-DE') : t.fromKm}</td>
                             <td>{(t.toKm != null && !isNaN(t.toKm)) ? Number(t.toKm).toLocaleString('de-DE') : t.toKm}</td>
                             <td>{(t.toKm != null && t.fromKm != null && !isNaN(t.toKm - t.fromKm)) ? Number(t.toKm - t.fromKm).toLocaleString('de-DE') : (t.toKm - t.fromKm)} KM</td>
                             <td>{t.note}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          )}

          {logType === 'fahrt' && tripLogMode === 'strict' && (
             currentBusinessTripLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <table className="print-table">
                 <thead><tr><th>Datum</th><th>Fahrer</th><th>Kategorie</th><th>Start KM</th><th>Ziel KM</th><th>Strecke</th><th>Straße</th><th>Hausnr.</th><th>PLZ</th><th>Ort</th><th>Zweck</th><th>Geschäftspartner</th><th>Notiz / Route</th></tr></thead>
                 <tbody>
                     {currentBusinessTripLog.map((t:any) => (
                         <tr key={t.id}>
                             <td>{new Date(t.date).toLocaleDateString('de-DE')}</td>
                             <td>{t.driver}</td>
                             <td>{t.category}</td>
                             <td>{(t.fromKm != null && !isNaN(t.fromKm)) ? Number(t.fromKm).toLocaleString('de-DE') : t.fromKm}</td>
                             <td>{(t.toKm != null && !isNaN(t.toKm)) ? Number(t.toKm).toLocaleString('de-DE') : t.toKm}</td>
                             <td>{(t.toKm != null && t.fromKm != null && !isNaN(t.toKm - t.fromKm)) ? Number(t.toKm - t.fromKm).toLocaleString('de-DE') : (t.toKm - t.fromKm)} KM</td>
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

function ReiseView({ state, setState, orientation, orientationPermission, requestOrientationPermission }: any) {
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isAudioAssistActive, setIsAudioAssistActive] = useState(false);
  const [soundTestIndex, setSoundTestIndex] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const latestDirectionRef = useRef<string>('level');
  const latestIntensityRef = useRef<number>(0);
  const wasLevelRef = useRef<boolean>(false);
  const mainOscRef = useRef<OscillatorNode | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const tremoloOscRef = useRef<OscillatorNode | null>(null);
  const tremoloGainRef = useRef<GainNode | null>(null);
  const roughOscRef = useRef<OscillatorNode | null>(null);
  const roughGainRef = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);

  const calibratedPitch = (orientation?.pitch || 0) - (state.profile.pitchOffset || 0);
  const calibratedRoll = (orientation?.roll || 0) - (state.profile.rollOffset || 0);

  const pitchNormalized = Math.max(-20, Math.min(20, calibratedPitch));
  const rollNormalized = Math.max(-20, Math.min(20, calibratedRoll));
  const heading = orientation?.heading || 0;

  // Audio Level Assist - Internes Richtungsmodell (welche Seite muss angehoben werden)
  const deadzone = 0.5;
  let assistDirection = 'level';
  const needRaiseFront = calibratedPitch > deadzone;
  const needRaiseRear = calibratedPitch < -deadzone;
  const needRaiseRight = calibratedRoll > deadzone;
  const needRaiseLeft = calibratedRoll < -deadzone;

  if (needRaiseFront && needRaiseLeft) assistDirection = 'rearRight';
  else if (needRaiseFront && needRaiseRight) assistDirection = 'rearLeft';
  else if (needRaiseRear && needRaiseLeft) assistDirection = 'frontRight';
  else if (needRaiseRear && needRaiseRight) assistDirection = 'frontLeft';
  else if (needRaiseFront) assistDirection = 'rear';
  else if (needRaiseRear) assistDirection = 'front';
  else if (needRaiseLeft) assistDirection = 'right';
  else if (needRaiseRight) assistDirection = 'left';

  const tiltIntensity = Math.sqrt(calibratedPitch * calibratedPitch + calibratedRoll * calibratedRoll);

  latestDirectionRef.current = assistDirection;
  latestIntensityRef.current = tiltIntensity;

// === KONTINUIERLICHE SONIFIKATION (Tiltification-Prinzip) ===

  const playLockChord = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const now = ctx.currentTime;
      const chordGain = ctx.createGain();
      chordGain.gain.setValueAtTime(0.25, now);
      chordGain.connect(ctx.destination);
      [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          const t = now + i * 0.03;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.2, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
          osc.connect(g);
          g.connect(chordGain);
          osc.start(t);
          osc.stop(t + 0.85);
      });
  };

  const startContinuousAudio = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      // --- Haupt-Oszillator (Links/Rechts = Tonhöhe) ---
      const mainOsc = ctx.createOscillator();
      const mainGain = ctx.createGain();
      mainOsc.type = 'sine';
      mainOsc.frequency.setValueAtTime(440, ctx.currentTime);
      mainGain.gain.setValueAtTime(0.3, ctx.currentTime);
      mainOsc.connect(mainGain);
      mainGain.connect(ctx.destination);
      mainOsc.start();
      mainOscRef.current = mainOsc;
      mainGainRef.current = mainGain;

      // --- Tremolo-Oszillator (Vorne = schnelles Lautstärke-Pulsieren) ---
      const tremoloOsc = ctx.createOscillator();
      const tremoloGain = ctx.createGain();
      tremoloOsc.type = 'sine';
      tremoloOsc.frequency.setValueAtTime(0, ctx.currentTime); // 0Hz = kein Tremolo
      tremoloGain.gain.setValueAtTime(0, ctx.currentTime); // 0 = kein Effekt
      tremoloOsc.connect(tremoloGain);
      tremoloGain.connect(mainGain.gain); // Moduliert die Lautstärke des Haupttons
      tremoloOsc.start();
      tremoloOscRef.current = tremoloOsc;
      tremoloGainRef.current = tremoloGain;

      // --- Rauheits-Oszillator (Hinten = verstimmter Zweiter Ton) ---
      const roughOsc = ctx.createOscillator();
      const roughGain = ctx.createGain();
      roughOsc.type = 'sine';
      roughOsc.frequency.setValueAtTime(440, ctx.currentTime);
      roughGain.gain.setValueAtTime(0, ctx.currentTime); // Anfangs stumm
      roughOsc.connect(roughGain);
      roughGain.connect(ctx.destination);
      roughOsc.start();
      roughOscRef.current = roughOsc;
      roughGainRef.current = roughGain;

      // --- Rosa Rauschen (Level-Nähe) ---
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
          b6 = white * 0.115926;
      }
      const noiseSource = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;
      noiseGain.gain.setValueAtTime(0, ctx.currentTime);
      noiseSource.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start();
      noiseSourceRef.current = noiseSource;
      noiseGainRef.current = noiseGain;
  };

  const stopContinuousAudio = () => {
      try {
          mainOscRef.current?.stop();
          tremoloOscRef.current?.stop();
          roughOscRef.current?.stop();
          noiseSourceRef.current?.stop();
      } catch (e) {}
      mainOscRef.current = null;
      mainGainRef.current = null;
      tremoloOscRef.current = null;
      tremoloGainRef.current = null;
      roughOscRef.current = null;
      roughGainRef.current = null;
      noiseSourceRef.current = null;
      noiseGainRef.current = null;
  };

  const updateContinuousAudio = () => {
      const ctx = audioCtxRef.current;
      if (!ctx || !mainOscRef.current) return;

      const now = ctx.currentTime;
      const roll = calibratedRoll;   // Links/Rechts in Grad
      const pitch = calibratedPitch; // Vorne/Hinten in Grad
      const dz = deadzone;

      const isLevel = Math.abs(roll) <= dz && Math.abs(pitch) <= dz;

      // === LINKS/RECHTS: Tonhöhe ===
      // Mitte = 440Hz, ±10° = ±1 Oktave (220Hz bis 880Hz)
      const rollClamped = Math.max(-10, Math.min(10, roll));
      const semitones = (rollClamped / 10) * 12; // ±12 Halbtöne
      const freq = 440 * Math.pow(2, semitones / 12);
      mainOscRef.current.frequency.setTargetAtTime(freq, now, 0.05);

      // Rauheits-Oszillator folgt der Grundfrequenz (leicht verstimmt)
      if (roughOscRef.current) {
          roughOscRef.current.frequency.setTargetAtTime(freq * 1.02, now, 0.05);
      }

      // === VORNE/HINTEN: Tremolo + Rauheit ===
      if (pitch > dz) {
          // VORNE ZU HOCH: Tremolo (Lautstärke-Pulsieren)
          const tremoloSpeed = 2 + (Math.min(pitch, 10) / 10) * 12; // 2Hz bis 14Hz
          const tremoloDepth = Math.min(pitch / 5, 0.3); // Wie stark die Lautstärke schwankt
          if (tremoloOscRef.current && tremoloGainRef.current) {
              tremoloOscRef.current.frequency.setTargetAtTime(tremoloSpeed, now, 0.05);
              tremoloGainRef.current.gain.setTargetAtTime(tremoloDepth, now, 0.05);
          }
          // Rauheit aus
          if (roughGainRef.current) {
              roughGainRef.current.gain.setTargetAtTime(0, now, 0.05);
          }
      } else if (pitch < -dz) {
          // HINTEN ZU HOCH: Rauheit (zwei verstimmte Oszillatoren)
          const roughAmount = Math.min(Math.abs(pitch) / 8, 0.25); // Lautstärke des 2. Oszillators
          if (roughGainRef.current) {
              roughGainRef.current.gain.setTargetAtTime(roughAmount, now, 0.05);
          }
          // Tremolo aus
          if (tremoloGainRef.current) {
              tremoloGainRef.current.gain.setTargetAtTime(0, now, 0.05);
          }
      } else {
          // In der Deadzone für Pitch: Beides aus
          if (tremoloGainRef.current) {
              tremoloGainRef.current.gain.setTargetAtTime(0, now, 0.05);
          }
          if (roughGainRef.current) {
              roughGainRef.current.gain.setTargetAtTime(0, now, 0.05);
          }
      }

      // === LEVEL-NÄHE: Rosa Rauschen ===
      const tiltTotal = Math.sqrt(roll * roll + pitch * pitch);
      const levelProximity = Math.max(0, 1 - tiltTotal / 3); // 1 = am Level, 0 = >3° weg
      if (noiseGainRef.current) {
          const noiseVol = isLevel ? 0.12 : levelProximity * 0.08;
          noiseGainRef.current.gain.setTargetAtTime(noiseVol, now, 0.1);
      }

      // === HAUPTLAUTSTÄRKE: Im Level leiser, sonst normal ===
      if (mainGainRef.current) {
          const mainVol = isLevel ? 0.08 : 0.3;
          mainGainRef.current.gain.setTargetAtTime(mainVol, now, 0.1);
      }

      // === LOCK-AKKORD: Einmalig beim Erreichen des Levels ===
      if (isLevel && !wasLevelRef.current) {
          playLockChord();
          wasLevelRef.current = true;
      } else if (!isLevel) {
          wasLevelRef.current = false;
      }
  };

  // --- useEffect: Audio starten/stoppen ---
  useEffect(() => {
      if (isAudioAssistActive) {
          if (audioCtxRef.current && audioCtxRef.current.state !== 'suspended') {
              startContinuousAudio();
          }
      }
      return () => {
          stopContinuousAudio();
      };
  }, [isAudioAssistActive]);

  // --- useEffect: Audio-Parameter in Echtzeit aktualisieren ---
  useEffect(() => {
      if (isAudioAssistActive && mainOscRef.current) {
          updateContinuousAudio();
      }
  }, [calibratedPitch, calibratedRoll, isAudioAssistActive]);

  const handleTaraReset = () => {
      setState((prev: any) => ({ ...prev, profile: { ...prev.profile, pitchOffset: 0, rollOffset: 0 } }));
  };

  const handleAudioToggle = async () => {
    if (!isAudioAssistActive) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
        }
        setIsAudioAssistActive(true);

        const ctx = audioCtxRef.current;
        
        // --- 1. Ready-Testton ---
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);

        // --- 2. Richtungstestton ---
        // Kontinuierlicher Ton startet automatisch über useEffect

      } catch (e) {
        console.warn("AudioContext creation failed:", e);
      }
    } else {
      setIsAudioAssistActive(false);
    }
  };

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
      {orientationPermission === 'prompt' && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--accent)]/30">
          <p className="text-sm text-gray-300 mb-3">
            Um Kompass und Wasserwaage nutzen zu können, wird Zugriff auf die Bewegungssensoren benötigt.
          </p>
          <button 
            onClick={requestOrientationPermission}
            className="w-full py-2 px-4 rounded-lg bg-[var(--accent)] text-white font-bold text-sm"
          >
            Sensoren aktivieren
          </button>
        </div>
      )}
      
      <div className="relative overflow-hidden p-6 z-0 rounded-xl bg-gradient-to-b from-[#1c1e22] to-[#0e1013] shadow-[0_10px_30px_rgba(0,0,0,0.8),_inset_0_1px_1px_rgba(255,255,255,0.02)] border border-[#000]">
        {/* Deep Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)] pointer-events-none z-0" />

        {/* Subtle technical background structure */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.03),transparent_50%)] pointer-events-none" />
        
        {/* Premium Metallic Screws (Panel Corners) */}
        <div className="absolute top-3 left-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute top-3 right-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute bottom-3 left-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute bottom-3 right-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>

        <div className="text-[13px] text-[#8a939c] font-bold tracking-[0.3em] mb-8 text-center relative z-10 uppercase" style={{ textShadow: '0 -2px 2px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.08), 0 0 4px rgba(0,0,0,0.6)' }}>LAGE & KOMPASS</div>
        
        <div className="flex flex-col items-center gap-6 relative z-10">

              {/* Instrument Recess (Mulde) */}
              <div className="relative w-[280px] h-[280px] flex items-center justify-center bg-gradient-to-b from-[#08090a] to-[#16181b] rounded-full shadow-[inset_0_12px_24px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90 shrink-0">
              
              {/* Actual Compass Outer Ring */}
              <div className="absolute w-[260px] h-[260px] rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_10px_30px_rgba(0,0,0,0.9),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-2px_8px_rgba(0,0,0,0.8)] border border-[#000] z-0 pointer-events-none" />
              
              {/* Inner Bevel of the ring */}
              <div className="absolute w-[214px] h-[214px] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_4px_10px_rgba(0,0,0,0.9)] z-0 pointer-events-none border border-black/80" />

              {/* Inner Compass Glass Face */}
              <div className="absolute w-[210px] h-[210px] flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_15px_30px_rgba(0,0,0,0.95)] overflow-hidden z-10">
                  {/* Glass highlight top */}
                  <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/5 to-transparent rounded-[100%] pointer-events-none" />
                  
                  {/* Grid lines */}
                  <div className="absolute w-[1px] h-full bg-gradient-to-b from-transparent via-[#10b981]/60 to-transparent left-1/2 -translate-x-1/2" />
                  <div className="absolute h-[1px] w-full bg-gradient-to-r from-transparent via-[#10b981]/60 to-transparent top-1/2 -translate-y-1/2" />
                  
                  {/* Inner technical rings */}
                  <div className="absolute w-[140px] h-[140px] rounded-full border border-[#10b981]/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]" />
                  <div className="absolute w-[80px] h-[80px] rounded-full border border-[#10b981]/15 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]" />
                  
                  {/* Center glowing radar circle */}
                  <div className="absolute w-[36px] h-[36px] rounded-full border border-[#10b981]/50 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.35)_0%,_transparent_70%)] shadow-[0_0_30px_rgba(16,185,129,0.5),_inset_0_0_15px_rgba(16,185,129,0.3)]" />
              </div>

              {/* Compass marks mounted on the Ring (z-20 so it sits freely above the inner face but inside the 260 box) */}
              <div 
                className="absolute z-20 w-[254px] h-[254px] transition-transform duration-500 ease-out" 
                style={{ transform: `rotate(${-heading || 0}deg)` }}
              >
                {[...Array(72)].map((_, i) => {
                  const deg = i * 5;
                  const isCardinal = deg % 90 === 0;
                  const isOrdinal = deg % 45 === 0 && !isCardinal;
                  const isTen = deg % 10 === 0 && !isCardinal;
                  
                  return (
                    <div 
                      key={i} 
                      className="absolute inset-0 flex justify-center z-10 pointer-events-none"
                      style={{ transform: `rotate(${deg}deg)` }}
                    >
                      {deg === 0 && <div className="mt-[2px] font-black text-[16px] leading-none text-[#ff6600] drop-shadow-[0_0_8px_rgba(255,102,0,0.8)]">N</div>}
                      {deg === 90 && <div className="mt-[3px] font-black text-[13px] leading-none text-[#ccc] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">E</div>}
                      {deg === 180 && <div className="mt-[3px] font-black text-[13px] leading-none text-[#ccc] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">S</div>}
                      {deg === 270 && <div className="mt-[3px] font-black text-[13px] leading-none text-[#ccc] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">W</div>}
                      
                      {!isCardinal && isOrdinal && <div className="mt-[4px] w-[2.5px] h-[8px] bg-[#ff6600] rounded-sm shadow-[0_0_6px_rgba(255,102,0,0.7)]" />}
                      {!isCardinal && !isOrdinal && isTen && <div className="mt-[5px] w-[2px] h-[6px] bg-[#888] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                      {!isCardinal && !isOrdinal && !isTen && <div className="mt-[6px] w-[1px] h-[4px] bg-[#555] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                    </div>
                  );
                })}
              </div>

              {/* The Bubble (LED Sphere) - Z-30 */}
              {(() => {
                const rawBubbleX = -rollNormalized * 3.8;
                const rawBubbleY = -pitchNormalized * 3.8;
                const distance = Math.sqrt(rawBubbleX * rawBubbleX + rawBubbleY * rawBubbleY);
                const maxRadius = 88;
                
                let bubbleX = rawBubbleX;
                let bubbleY = rawBubbleY;
                
                if (distance > maxRadius) {
                  const scale = maxRadius / distance;
                  bubbleX *= scale;
                  bubbleY *= scale;
                }

                return (
                  <div className="absolute w-[210px] h-[210px] flex items-center justify-center rounded-full overflow-hidden z-30 pointer-events-none">
                    <motion.div 
                        className="absolute w-[36px] h-[36px] rounded-full overflow-hidden"
                        style={{
                          background: 'radial-gradient(circle at 35% 35%, #a7f3d0 0%, #34d399 25%, #059669 60%, #064e3b 100%)',
                          boxShadow: '0 10px 20px rgba(0,0,0,0.9), 0 0 25px rgba(16,185,129,0.7), inset 0 3px 6px rgba(255,255,255,0.9), inset 0 -6px 12px rgba(0,0,0,0.9), inset -2px -2px 8px rgba(110,231,183,0.6)',
                          border: '1px solid rgba(255,255,255,0.3)'
                        }}
                        animate={{ 
                          x: bubbleX,
                          y: bubbleY 
                        }}
                        transition={{ type: 'spring', stiffness: 70, damping: 18, mass: 0.8 }}
                    >
                        <div className="absolute top-[3px] left-[6px] w-[16px] h-[8px] bg-white/60 rounded-full rotate-[-40deg] blur-[1px] pointer-events-none" />
                        <div className="absolute top-[5px] left-[8px] w-[6px] h-[3px] bg-white rounded-full rotate-[-40deg] blur-[0.5px] pointer-events-none" />
                    </motion.div>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-row items-center justify-center mt-2 gap-8 w-full">
              {/* Box X (Roll) */}
              {(() => {
                const abs = Math.abs(rollNormalized);
                const val = abs <= 0.5 ? 0 : Math.round(abs);
                const valStyle = val === 0 ? {
                  color: '#00ff9c',
                  textShadow: '0 0 2px rgba(0,255,156,0.3)'
                } : {
                  color: '#ff8a2a',
                  textShadow: '0 0 2px rgba(255,138,42,0.3)'
                };
                return (
                  <div className="relative aspect-square w-[120px] rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                      <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                          <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                          <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${val === 0 ? '#00ff9c' : '#ff5a00'} 0%, transparent 70%)` }} />
                          <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: val === 0 ? '#00ff9c' : '#ff5a00', boxShadow: `0 -2px 8px ${val === 0 ? '#00ff9c' : '#ff5a00'}` }} />
                      </div>
                      <div className="absolute -top-5 w-full text-center z-40">
                          <div className="text-[10px] text-[#555] font-bold tracking-[0.2em] uppercase">HORIZONTAL</div>
                      </div>
                      <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-2">
                          <div className="flex items-baseline justify-center translate-x-[4px] mb-[2px]">
                              <span className="text-4xl leading-none font-mono font-bold" style={valStyle}>{val}</span>
                              <span className="text-[12px] text-[#444] ml-0.5">°</span>
                          </div>
                          <div style={{ color: val === 0 ? '#00ff9c' : '#ff5a00', filter: `drop-shadow(0 0 4px ${val === 0 ? '#00ff9c' : '#ff5a00'}80)` }}>
                              <ArrowLeftRight size={14} />
                          </div>
                      </div>
                  </div>
                );
              })()}

              {/* Box Y (Pitch) */}
              {(() => {
                const abs = Math.abs(pitchNormalized);
                const val = abs <= 0.5 ? 0 : Math.round(abs);
                const valStyle = val === 0 ? {
                  color: '#00ff9c',
                  textShadow: '0 0 2px rgba(0,255,156,0.3)'
                } : {
                  color: '#ff8a2a',
                  textShadow: '0 0 2px rgba(255,138,42,0.3)'
                };
                return (
                  <div className="relative aspect-square w-[120px] rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                      <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                          <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                          <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${val === 0 ? '#00ff9c' : '#ff5a00'} 0%, transparent 70%)` }} />
                          <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: val === 0 ? '#00ff9c' : '#ff5a00', boxShadow: `0 -2px 8px ${val === 0 ? '#00ff9c' : '#ff5a00'}` }} />
                      </div>
                      <div className="absolute -top-5 w-full text-center z-40">
                          <div className="text-[10px] text-[#555] font-bold tracking-[0.2em] uppercase">VERTIKAL</div>
                      </div>
                      <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-2">
                          <div className="flex items-baseline justify-center translate-x-[4px] mb-[2px]">
                              <span className="text-4xl leading-none font-mono font-bold" style={valStyle}>{val}</span>
                              <span className="text-[12px] text-[#444] ml-0.5">°</span>
                          </div>
                          <div style={{ color: val === 0 ? '#00ff9c' : '#ff5a00', filter: `drop-shadow(0 0 4px ${val === 0 ? '#00ff9c' : '#ff5a00'}80)` }}>
                              <ArrowUpDown size={14} />
                          </div>
                      </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="w-full flex justify-center gap-4 mt-6">
              <button
                onClick={() => setState({ ...state, profile: { ...state.profile, pitchOffset: orientation?.pitch || 0, rollOffset: orientation?.roll || 0 } })}
                className="cg-master-button"
                title="Aktuelle Position als waagerecht setzen"
              >
                TARA
              </button>
              <button
                onClick={handleAudioToggle}
                className="cg-master-button"
                title="Audio Level Assist aktivieren"
              >
                {isAudioAssistActive ? 'AUDIO AN' : 'AUDIO ASSIST'}
              </button>
              {(state.profile.pitchOffset !== 0 || state.profile.rollOffset !== 0) && (
                <button
                  onClick={handleTaraReset}
                  className="cg-master-button"
                  title="Tara-Kalibrierung zurücksetzen auf Werkseinstellung"
                >
                  TARA RESET
                </button>
              )}
            </div>

            {/* HÖHENKORREKTUR */}
            <div className="w-full flex justify-center">
              <div 
                className="w-full max-w-[280px] rounded-xl flex flex-col items-center justify-center p-5 relative cg-panel"
              >
                 <div className="text-[11px] cg-master-muted font-bold tracking-[0.25em] uppercase mb-6" style={{ textShadow: '0 -1px 1px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.05)' }}>Höhenkorrektur</div>
                 
                 <div className="w-full flex items-center justify-between relative px-2">
                    {/* Outline Camper */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[42px] h-[90px] border-2 border-[#999] rounded-t-[14px] rounded-b-[8px] opacity-80" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.05))' }}>
                         <div className="absolute top-[14px] left-[2px] right-[2px] h-[12px] border-2 border-[#999] rounded-[4px]" />
                    </div>

                    {(() => {
                      const getStyle = (val: number) => val === 0 ? {
                        color: '#00ff9c',
                        textShadow: '0 0 3px rgba(0,255,156,0.25)'
                      } : {
                        color: '#ff8a2a',
                        textShadow: '0 0 3px rgba(255,122,0,0.35)'
                      };
                      const tw = state.profile.trackWidth || 0;
                      const wb = state.profile.wheelbase || 0;
                      const hasHeightCorrectionDimensions = tw > 0 && wb > 0;
                      const rollRad = (calibratedRoll * Math.PI) / 180;
                      const pitchRad = (calibratedPitch * Math.PI) / 180;
                      
                      const sideCorrection = tw > 0 ? Math.abs(tw * Math.sin(rollRad)) : 0;
                      const sideLeft = calibratedRoll > deadzone ? Math.round(sideCorrection * 10) / 10 : 0;
                      const sideRight = calibratedRoll < -deadzone ? Math.round(sideCorrection * 10) / 10 : 0;
                      
                      const lengthCorrection = wb > 0 ? Math.abs(wb * Math.sin(pitchRad)) : 0;
                      const frontUp = calibratedPitch > deadzone ? Math.round(lengthCorrection * 10) / 10 : 0;
                      const rearUp = calibratedPitch < -deadzone ? Math.round(lengthCorrection * 10) / 10 : 0;
                      
                      const hFL = Math.round(Math.max(sideLeft + frontUp, 0) * 10) / 10;
                      const hHL = Math.round(Math.max(sideLeft + rearUp, 0) * 10) / 10;
                      const hFR = Math.round(Math.max(sideRight + frontUp, 0) * 10) / 10;
                      const hHR = Math.round(Math.max(sideRight + rearUp, 0) * 10) / 10;
                      const maxHeight = Math.max(hFL, hHL, hFR, hHR);
                      const vFL = Math.round(Math.max(maxHeight - hFL, 0));
                      const vHL = Math.round(Math.max(maxHeight - hHL, 0));
                      const vFR = Math.round(Math.max(maxHeight - hFR, 0));
                      const vHR = Math.round(Math.max(maxHeight - hHR, 0));
                      return (
                        <>
                          {hasHeightCorrectionDimensions ? (
                            <>
                              <div className="flex flex-col gap-6 text-left z-10">
                                 <div>
                                   <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Vorne Links</div>
                                   <div className="flex items-baseline">
                                     <span className="text-[24px] leading-none font-mono font-bold tabular-nums" style={getStyle(vFL)}>{vFL}</span>
                                     <span className="text-[12px] cg-master-muted ml-1">cm</span>
                                   </div>
                                 </div>
                                 <div>
                                   <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Hinten Links</div>
                                   <div className="flex items-baseline">
                                     <span className="text-[24px] leading-none font-mono font-bold tabular-nums" style={getStyle(vHL)}>{vHL}</span>
                                     <span className="text-[12px] cg-master-muted ml-1">cm</span>
                                   </div>
                                 </div>
                              </div>
                              
                              <div className="flex flex-col gap-6 text-right z-10">
                                 <div>
                                   <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Vorne Rechts</div>
                                   <div className="flex items-baseline justify-end">
                                     <span className="text-[24px] leading-none font-mono font-bold tabular-nums" style={getStyle(vFR)}>{vFR}</span>
                                     <span className="text-[12px] cg-master-muted ml-1">cm</span>
                                   </div>
                                 </div>
                                 <div>
                                   <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Hinten Rechts</div>
                                   <div className="flex items-baseline justify-end">
                                     <span className="text-[24px] leading-none font-mono font-bold tabular-nums" style={getStyle(vHR)}>{vHR}</span>
                                     <span className="text-[12px] cg-master-muted ml-1">cm</span>
                                   </div>
                                 </div>
                              </div>
                            </>
                          ) : ( <div className="cg-master-inset rounded-xl p-4 text-center"> <div className="cg-master-label !mb-1">Höhenkorrektur nicht verfügbar</div> <div className="cg-type-meta cg-master-muted">Bitte Spurbreite und Achsabstand im Profil eintragen.</div> </div> )}
                        </>
                      );
                    })()}
                 </div>
              </div>
            </div>

        </div>
      </div>

      <div className="relative overflow-hidden p-1.5 z-0 cg-panel">
        
        <style>{`
          .leaflet-control-attribution {
            background-color: rgba(0, 0, 0, 0.4) !important;
            color: #777 !important;
            font-size: 8px !important;
            backdrop-filter: blur(4px);
            border-top-left-radius: 6px;
            padding: 2px 6px !important;
          }
          .leaflet-control-attribution a {
            color: #999 !important;
            text-decoration: none !important;
          }
          .leaflet-control-attribution a:hover {
            color: #bbb !important;
          }
        `}</style>
        <div className="relative overflow-hidden z-0 h-[400px] w-full cg-inset">
            <MapContainer id="map" center={[51.1657, 10.4515]} zoom={6} zoomControl={false} style={{ height: '100%', width: '100%', background: '#0a0b0c' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <MapHandlerComponent destination={destination} setDestination={setDestination} setDistance={setDistance} range={range} />
              <ResizeMapComponent />
            </MapContainer>
        </div>
      </div>

    </div>
  );
}
