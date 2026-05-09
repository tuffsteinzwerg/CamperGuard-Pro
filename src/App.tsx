import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Settings, Map as MapIcon, BookOpen, Package, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'leaflet/dist/leaflet.css';
import './lib/setupLeafletIcons';
import { openDB } from 'idb';
import { INITIAL_STATE, AppState } from './types.ts';
import { normalizeGearName } from './lib/formatters';
import { NavButton } from './components/NavButton';
import { StatusView } from './views/StatusView';
import { ProfilView } from './views/ProfilView';
import { InhaltView } from './views/InhaltView';
import { LogbuchView } from './views/LogbuchView';
import { ReiseView } from './views/ReiseView';
import { CHANGELOG } from './data/changelog';

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
          CamperGuard Pro v0.1.5-dev
        </div>

        {showChangelog && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col p-4 no-print overflow-hidden items-center justify-center">
            <div className="bg-[var(--bg-app)] rounded-xl border border-[var(--border)] max-w-2xl w-full text-[12px] text-white flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-[var(--border)] flex justify-between items-center sticky top-0 z-10 bg-[var(--bg-card)] rounded-t-xl cg-master-card-small">
                 <div>
                   <h2 className="text-lg font-bold text-[var(--primary)] mb-1">CamperGuard Pro v0.1.5-dev</h2>
                   <p className="text-[var(--text-muted)] !mb-0">Stand: 09.05.2026</p>
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
