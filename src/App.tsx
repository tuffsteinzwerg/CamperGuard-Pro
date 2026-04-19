import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, Settings, Map as MapIcon, BookOpen, Package, Activity, 
  Plus, Trash2, ChevronRight, Save, Search, Navigation, AlertTriangle,
  FileDown, ChevronDown, ChevronUp, Printer, MapPin, Volume2, Archive, CheckCircle, Check,
  ShieldPlus, Phone, Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
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

const ViewTitle = ({ children, right }: { children: React.ReactNode, right?: React.ReactNode }) => (
  <div className="flex justify-between items-end mb-4 px-2 no-print">
      <h1 className="text-sm font-black text-[#FF6600] uppercase tracking-[0.2em]">{children}</h1>
      {right}
  </div>
);

const Card = (props: any) => {
  const { children, className, ...rest } = props;
  // Using pure #2C2E30 instead of #2a2a2a etc
  return (
    <div className={`bg-[#2C2E30] rounded-lg p-4 border border-[#3d3d3d] ${className || ""}`} {...rest}>
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
           setState({ 
             ...INITIAL_STATE, 
             ...saved, 
             exchangeRates: saved.exchangeRates || INITIAL_STATE.exchangeRates,
             sos: saved.sos || INITIAL_STATE.sos 
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
    if (!loading) {
      initDB().then(db => db.put('store', state, 'state'));
    }
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

  if (loading) return <div className="fixed inset-0 bg-[#1A1C1E] z-[999]" />;

  return (
    <div className="min-h-screen pb-24 lg:max-w-none max-w-md mx-auto relative bg-[#1A1C1E] text-white">
      <img src="/CamperguardPro_Logo.jpeg" className="print-logo hidden" alt="Logo" />
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1cm; }
          body { background: white !important; color: black !important; font-size: 11pt !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-logo { display: block !important; position: fixed; bottom: 10px; left: 10px; width: 150px; z-index: 9999; }
          .high-density-grid, .bg-\\[\\#1A1C1E\\], .bg-\\[\\#2C2E30\\] { background: white !important; border:none; }
          * { text-shadow: none !important; box-shadow: none !important; font-size: 11pt !important; }
          .text-white, .text-\\[\\#FF6600\\] { color: black !important; }
          h1, h2, h3, span, div { color: black !important; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .print-table th { background: #eee !important; color: black !important; font-weight: bold; border: 1px solid #000; padding: 4px; text-align: left;}
          .print-table td { border: 1px solid #000; padding: 4px; }
          .print-table tr:nth-child(even) { background: #f9f9f9 !important; }
        }
        .leaflet-container { color: white !important; font-family: inherit !important; }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: #2C2E30 !important; color: white !important; }
        .leaflet-popup-content { margin: 8px 12px; }
      `}</style>
      
      <header className="h-[60px] px-4 bg-[#111] border-b-2 border-[#FF6600] sticky top-0 z-40 flex justify-between items-center no-print">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-[#FF6600]" size={20} />
          <span className="font-black text-sm uppercase tracking-[0.1em] text-[#FF6600]">
            {state.profile.vehicleName || "Camper"} <span className="text-white mx-1">|</span> {state.profile.plate || "M-CG 2024"}
          </span>
        </div>
        <button onClick={() => setActiveTab('profil')} className="p-2 rounded bg-black/40 border border-[#3d3d3d] active:scale-95 transition-all text-white hover:text-[#FF6600]">
          <Settings size={16} />
        </button>
      </header>

      <main className="p-4 overflow-y-auto lg:max-w-6xl lg:mx-auto min-h-[80vh]">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {activeTab === 'status' && <StatusView state={state} setState={setState} orientation={orientation} />}
            {activeTab === 'inhalt' && <InhaltView state={state} setState={setState} />}
            {activeTab === 'logbuch' && <LogbuchView state={state} setState={setState} />}
            {activeTab === 'reise' && <ReiseView state={state} setState={setState} />}
            {activeTab === 'profil' && <ProfilView state={state} setState={setState} demoSeed={demoSeed} />}
          </motion.div>
        </AnimatePresence>
      </main>

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
    <button onClick={onClick} className={`flex-1 flex flex-col items-center gap-1 transition-all ${active ? 'text-[#FF6600]' : 'text-white'}`}>
      <motion.div animate={active ? { scale: 1.1 } : { scale: 1 }}>{icon}</motion.div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-indicator" className="w-4 h-0.5 bg-[#FF6600] mt-1" />}
    </button>
  );
}
// --- SUBVIEWS ---
function StatusView({ state, setState, orientation }: any) {
  const [showSos, setShowSos] = useState(false);
  const [sosTab, setSosTab] = useState<'hilfe'|'id'|'inventar'>('hilfe');
  const [audioAssist, setAudioAssist] = useState(false);
  const [gpsAlt, setGpsAlt] = useState<number|null>(null);
  const audioRef = useRef<any>(null);

  const pitchNormalized = Math.max(-20, Math.min(20, orientation.pitch));
  const rollNormalized = Math.max(-20, Math.min(20, orientation.roll));
  const heading = orientation.heading;
  const isLevel = Math.abs(pitchNormalized) < 1.0 && Math.abs(rollNormalized) < 1.0;
  
  const waterWeightImpact = (state.waterLevel / 100) * (state.profile.fuelCapacity || 100);
  const totalWeight = (state.profile.emptyWeight || 0) + waterWeightImpact;

  useEffect(() => {
     let watchId: number | undefined;
     try {
       watchId = navigator.geolocation.watchPosition(
          p => setGpsAlt(p.coords.altitude),
          e => console.warn(e),
          { enableHighAccuracy: true }
       );
     } catch (err) {
       console.warn("Geolocation start error:", err);
     }
     return () => {
       if (watchId !== undefined) {
         try { navigator.geolocation.clearWatch(watchId); } catch(e){}
       }
     };
  }, []);

  useEffect(() => {
      if(!audioAssist) {
          if(audioRef.current) {
              const { ctx, osc, gain } = audioRef.current;
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
              setTimeout(() => { try { osc.stop(); ctx.close(); } catch(e){} }, 150);
              audioRef.current = null;
          }
          return;
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      audioRef.current = { ctx, osc, gain };

      return () => {
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          setTimeout(() => { try { osc.stop(); ctx.close(); } catch(e){} }, 150);
          audioRef.current = null;
      };
  }, [audioAssist]);

  useEffect(() => {
      if(audioRef.current && audioAssist) {
          const { ctx, osc } = audioRef.current;
          const dist = Math.abs(pitchNormalized) + Math.abs(rollNormalized);
          if (dist < 0.1) {
              osc.type = 'triangle';
              osc.frequency.setTargetAtTime(1000, ctx.currentTime, 0.05);
          } else {
              osc.type = 'sine';
              const freq = Math.max(300, 1200 - dist * 40); 
              osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
          }
      }
  }, [pitchNormalized, rollNormalized, audioAssist]);

  const updateSos = (field: string, val: any) => setState({...state, sos: {...state.sos, [field]: val}});

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="flex flex-col">
        <div className="text-[0.75rem] uppercase text-white font-semibold mb-3 tracking-widest flex justify-between">
            <span>Attitude & Wasser</span>
            <button onClick={() => setShowSos(true)} className="bg-orange-500 text-white px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1 animate-pulse border border-orange-400">
                <ShieldPlus size={12}/> SOS / NOTFALL
            </button>
        </div>
        
        <div className="flex items-center justify-between mb-4">
            <div className="text-center w-16">
                <div className="text-[0.6rem] text-white uppercase font-black tracking-widest">ROLL</div>
                <div className={`text-xl font-mono font-black ${Math.abs(rollNormalized) < 1 ? 'text-green-500' : 'text-[#FF6600]'}`}>{Math.abs(rollNormalized).toFixed(1)}°</div>
            </div>

            <div className="relative w-[160px] h-[160px] rounded-full border-4 border-[#3d3d3d] mx-auto overflow-hidden bg-[#111]">
                {/* crosshair */}
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/10" />

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Truck size={32} strokeWidth={1.5} className="text-white/20" />
                </div>

                <motion.div 
                  animate={{ x: rollNormalized * 3, y: pitchNormalized * 3 }}
                  transition={{ type: 'spring', bounce: 0, stiffness: 60 }}
                  className="absolute left-1/2 top-1/2 -ml-3 -mt-3 w-6 h-6 bg-[#FF6600] rounded-full shadow-[0_0_10px_rgba(255,102,0,0.5)] flex items-center justify-center"
                >
                  <div className="w-1.5 h-1.5 bg-black rounded-full" />
                </motion.div>

                <motion.div animate={{ rotate: -heading }} transition={{ type: 'spring', bounce: 0 }} className="absolute inset-1 rounded-full border border-white/10 pointer-events-none">
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] font-black text-[#FF6600] bg-[#111] px-1 rounded-b">N</span>
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-black text-[#FF6600] bg-[#111] px-1 rounded-t">S</span>
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#FF6600] bg-[#111] py-1 rounded-r">W</span>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#FF6600] bg-[#111] py-1 rounded-l">O</span>
                </motion.div>
            </div>

            <div className="text-center w-16">
                <div className="text-[0.6rem] text-white uppercase font-black tracking-widest">PITCH</div>
                <div className={`text-xl font-mono font-black ${Math.abs(pitchNormalized) < 1 ? 'text-green-500' : 'text-[#FF6600]'}`}>{Math.abs(pitchNormalized).toFixed(1)}°</div>
            </div>
        </div>
        
        <div className="flex justify-between items-center mb-6 px-2">
            <div className="flex flex-col gap-1 text-[10px] font-mono text-white/80 font-black">
                <div>
                   <span className="opacity-60 uppercase mr-1">ALT:</span>
                   {gpsAlt !== null ? <>{Math.round(gpsAlt)}m <span className="opacity-40 text-[8px]">(+/- 50m)</span></> : '---'}
                </div>
                <div>
                   <span className="opacity-60 uppercase mr-1">HDG:</span>
                   {Math.round(heading)}°
                </div>
            </div>
            <button onClick={() => setAudioAssist(!audioAssist)} className={`text-[9px] px-2 py-1 rounded font-black tracking-widest uppercase border ${audioAssist ? 'bg-[#FF6600] text-black border-[#FF6600]' : 'border-[#444] text-white'}`}>
                AudioAssist {audioAssist ? 'ON' : 'OFF'}
            </button>
        </div>
        
        <div className="space-y-4">
            <div>
                <div className="text-[0.65rem] uppercase text-white font-bold mb-2">Frischwasser</div>
                <input type="range" min="0" max="100" step="25" value={state.waterLevel} onChange={(e) => setState({...state, waterLevel: parseInt(e.target.value)})} className="w-full h-2 bg-[#444] rounded-full appearance-none cursor-pointer accent-[#FF6600]" />
                <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-white font-bold">{state.waterLevel}% ({formatNumber(waterWeightImpact, 0)}L)</span>
                    <span className="bg-black text-[#FF6600] text-[0.9rem] px-2 py-0.5 rounded font-mono font-bold">+ {formatNumber(waterWeightImpact, 1)} kg</span>
                </div>
            </div>
            <div className="pt-4 border-t border-[#3d3d3d]">
                <div className="text-[0.65rem] uppercase text-white font-bold mb-1">Gesamtgewicht</div>
                <div className="text-2xl font-black text-[#FF6600]">
                    {formatNumber(totalWeight, 0)} <span className="text-sm font-normal text-white">/ {formatNumber(state.profile.maxWeight || 3500, 0)} kg</span>
                </div>
            </div>
        </div>
      </Card>

      <Card className="flex flex-col h-full">
        <div className="text-[0.75rem] uppercase text-white font-semibold mb-3 tracking-widest">Wartung</div>
        <div className="grid grid-cols-2 gap-2 mb-6">
            {state.maintenance.map((item: any) => {
                const date = item.date ? new Date(item.date) : null;
                const diffInDays = date ? (date.getTime() - new Date().getTime()) / (1000 * 3600 * 24) : 999;
                const borderColor = diffInDays < 15 ? 'border-b-[#F44336]' : diffInDays < 60 ? 'border-b-[#FFC107]' : 'border-b-[#4CAF50]';
                return (
                    <div key={item.id} className={`bg-[#333] p-3 rounded flex flex-col items-center gap-1 border-b-4 ${borderColor}`}>
                        <span className="text-[0.65rem] text-white uppercase font-bold">{item.name}</span>
                        <span className="text-[0.85rem] font-bold text-white">{item.date ? new Date(item.date).toLocaleDateString('de-DE', { month: '2-digit', year: '2-digit' }) : 'N/A'}</span>
                    </div>
                );
            })}
        </div>
        <div className="text-[0.75rem] uppercase text-white font-semibold mb-3 tracking-widest">Abfahrt-Checkliste</div>
        <div className="flex-1 divide-y divide-[#333]">
            {state.checklist.map((item: any) => {
                const isCriticalPulsing = !item.checked && item.id === 'keile' && isLevel;
                return (
                    <div key={item.id} onClick={() => {
                            const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, checked: !c.checked} : c);
                            setState({...state, checklist: nc});
                        }}
                        className={`py-2 px-1 flex items-center gap-3 cursor-pointer group hover:bg-black/20 ${isCriticalPulsing ? 'animate-pulse text-red-500' : ''}`}
                    >
                        <div className={`w-[18px] h-[18px] border-2 border-[#FF6600] rounded-sm relative flex items-center justify-center transition-colors ${item.checked ? 'bg-[#FF6600]' : 'bg-transparent'}`}>
                             {item.checked && <Check size={14} className="text-black" />}
                        </div>
                        <span className={`text-[0.85rem] ${item.checked ? 'text-white/40 line-through' : 'text-white'}`}>{item.label}</span>
                    </div>
                );
            })}
        </div>
      </Card>
      
      <Card className="flex flex-col">
        <div className="text-[0.75rem] uppercase text-white font-semibold mb-3 tracking-widest">Letzte Log-Einträge</div>
        <div className="space-y-2 font-mono text-[0.75rem] overflow-y-auto max-h-[300px]">
            {state.fuelLog.slice(0,3).map((f:any) => (
                <div key={f.id} className="py-2 border-b border-[#333] flex justify-between text-white">
                    <span className="opacity-60">{new Date(f.date).toLocaleDateString('de-DE')}</span>
                    <span className="flex-1 px-2">Tanken: {f.fuelType}</span>
                    <span className="text-[#FF6600] font-bold">{formatNumber(f.liters, 1)}L</span>
                </div>
            ))}
            {state.tripLog.slice(0,3).map((t:any) => (
                <div key={t.id} className="py-2 border-b border-[#333] flex justify-between text-white">
                    <span className="opacity-60">{new Date(t.date).toLocaleDateString('de-DE')}</span>
                    <span className="flex-1 px-2">{t.destination}</span>
                    <span className="text-[#FF6600] font-bold">{formatNumber(t.toKm - t.fromKm, 0)}km</span>
                </div>
            ))}
        </div>
      </Card>

      <AnimatePresence>
          {showSos && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 overflow-y-auto">
                 <div className="flex justify-between items-center mb-4 pt-4 border-b border-[#3d3d3d] pb-4">
                     <h2 className="text-orange-500 font-black tracking-widest uppercase flex items-center gap-2 text-lg"><ShieldPlus size={24}/> SAFETY HUB</h2>
                     <button onClick={() => setShowSos(false)} className="text-white border border-[#3d3d3d] px-3 py-1 rounded hover:bg-[#333] font-black">X</button>
                 </div>

                 <div className="flex p-1 bg-[#1A1C1E] rounded border border-[#3d3d3d] overflow-x-auto hide-scrollbar mb-6">
                    {['hilfe', 'id', 'inventar'].map(t => (
                        <button key={t} onClick={() => setSosTab(t as any)} className={`flex-1 py-3 px-3 rounded text-[10px] font-black uppercase tracking-widest transition-all ${sosTab === t ? 'bg-[#2C2E30] text-orange-500 border border-orange-500/50' : 'text-white hover:text-white'}`}>
                            {t}
                        </button>
                    ))}
                 </div>

                 {sosTab === 'hilfe' && (
                     <div className="space-y-4 flex-1">
                         <Card className="bg-[#111] border-orange-500/50">
                             <h3 className="text-[10px] text-white uppercase font-black tracking-widest mb-2">Deine Position</h3>
                             <div className="font-mono text-xl text-orange-500 font-black tracking-tighter">
                                 {globalLeafletMap ? `${globalLeafletMap.getCenter().lat.toFixed(5)}, ${globalLeafletMap.getCenter().lng.toFixed(5)}` : 'GPS OFFLINE'}
                             </div>
                             {gpsAlt !== null && <div className="text-[10px] text-white mt-1">Höhe: {Math.round(gpsAlt)}m</div>}
                         </Card>

                         <div className="grid grid-cols-2 gap-4">
                             <a href="tel:112" className="bg-red-600 text-white p-6 rounded flex flex-col items-center justify-center font-black text-2xl border border-red-400 active:scale-95 transition-transform"><Phone size={32} className="mb-2"/> 112 <span className="text-[9px] uppercase font-bold mt-1">Europa</span></a>
                             <a href={`tel:${state.sos.icePhone}`} className="bg-orange-600 text-white p-4 rounded flex flex-col items-center justify-center font-black text-lg border border-orange-400 active:scale-95 transition-transform"><Phone size={24} className="mb-2"/> ICE Kontakt <span className="text-[9px] font-bold mt-1 uppercase text-center">{state.sos.iceName || 'Nicht konfiguriert'}</span></a>
                         </div>

                         <a href="https://www.google.com/maps/search/Apotheke" target="_blank" rel="noreferrer" className="block w-full text-center p-4 bg-[#2C2E30] border border-[#3d3d3d] rounded text-white font-black uppercase tracking-widest mt-4">Nächste Apotheke Suchen (Map)</a>
                     </div>
                 )}

                 {sosTab === 'id' && (
                     <div className="space-y-4">
                         <div><label className="text-[10px] font-black text-white uppercase tracking-widest block mb-1">Voller Name</label> <input value={state.sos.name} onChange={e => updateSos('name', e.target.value)} className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded" /></div>
                         <div><label className="text-[10px] font-black text-white uppercase tracking-widest block mb-1">Heimat-Adresse</label> <input value={state.sos.address} onChange={e => updateSos('address', e.target.value)} className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded" /></div>
                         
                         <div className="grid grid-cols-2 gap-3">
                             <div><label className="text-[10px] font-black text-white uppercase tracking-widest block mb-1">ICE Kontakt Name</label> <input value={state.sos.iceName} onChange={e => updateSos('iceName', e.target.value)} className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded" /></div>
                             <div><label className="text-[10px] font-black text-white uppercase tracking-widest block mb-1">ICE Telefon</label> <input value={state.sos.icePhone} onChange={e => updateSos('icePhone', e.target.value)} type="tel" className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded font-mono" /></div>
                         </div>

                         <div>
                             <label className="text-[10px] font-black text-white uppercase tracking-widest block mb-1">Blutgruppe</label>
                             <select value={state.sos.bloodGroup} onChange={e => updateSos('bloodGroup', e.target.value)} className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded font-black text-orange-500">
                                 <option value="">Unbekannt</option>
                                 {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'].map(b => <option key={b} value={b}>{b}</option>)}
                             </select>
                         </div>

                         <div><label className="text-[10px] font-black text-white uppercase tracking-widest block mb-1">Vorerkrankungen / Allergien</label> <textarea value={state.sos.medicalConditions} onChange={e => updateSos('medicalConditions', e.target.value)} className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded h-24" /></div>
                     </div>
                 )}

                 {sosTab === 'inventar' && (
                     <div className="space-y-6">
                         <div>
                             <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-[#3d3d3d] pb-2 mb-3">Notfall-Ausrüstung</h3>
                             {state.sos.gear.map((g: any, i: number) => (
                                 <div key={g.id} className="flex flex-col bg-[#111] p-3 rounded border border-[#3d3d3d] mb-2">
                                     <div className="flex justify-between items-center mb-2">
                                         <span className="font-bold text-white text-sm">{g.name}</span>
                                         <button onClick={() => { const ng = [...state.sos.gear]; ng[i].checked = !ng[i].checked; updateSos('gear', ng); }} className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center ${g.checked ? 'bg-red-500 border-red-500' : 'border-[#444]'}`}>{g.checked && <Check size={14} className="text-white"/>}</button>
                                     </div>
                                     <input value={g.location} onChange={e => { const ng = [...state.sos.gear]; ng[i].location = e.target.value; updateSos('gear', ng); }} placeholder="Lagerort (z.B. Beifahrertür)" className="w-full bg-transparent border-b border-[#333] text-white outline-none text-xs pb-1" />
                                 </div>
                             ))}
                         </div>
                         <div>
                             <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-[#3d3d3d] pb-2 mb-3 flex justify-between items-center">
                                 Apotheke 
                                 <button onClick={() => updateSos('pharmacy', [...state.sos.pharmacy, {id: Date.now().toString(), name:'Neu', purpose:'', expiry:'', location:'', quantity:1, unit:'stk'}])} className="text-[9px] border px-2 py-1 rounded">+ MEDIKAMENT</button>
                             </h3>
                             {state.sos.pharmacy.map((p: any, i: number) => (
                                 <div key={p.id} className="bg-[#111] p-3 rounded border border-[#3d3d3d] mb-2 relative">
                                     <button onClick={() => { const np = [...state.sos.pharmacy]; np.splice(i,1); updateSos('pharmacy', np); }} className="absolute top-2 right-2 text-red-500/50 hover:text-red-500 z-10"><Trash2 size={14}/></button>
                                     <div className="grid grid-cols-2 gap-2 mb-2 pr-6">
                                         <input value={p.name} onChange={e => { const np = [...state.sos.pharmacy]; np[i].name = e.target.value; updateSos('pharmacy', np); }} placeholder="Name" className="bg-transparent font-bold text-white outline-none text-sm border-b border-[#333]" />
                                         <input value={p.purpose} onChange={e => { const np = [...state.sos.pharmacy]; np[i].purpose = e.target.value; updateSos('pharmacy', np); }} placeholder="Zweck" className="bg-transparent text-white outline-none text-[10px] border-b border-[#333]" />
                                     </div>
                                     <div className="grid grid-cols-2 gap-2 mb-2">
                                         <div className="flex gap-1 items-center border-b border-[#333] pb-1">
                                             <span className="text-[8px] uppercase font-black text-white">EXP:</span>
                                             <input type="month" value={p.expiry} onChange={e => { const np = [...state.sos.pharmacy]; np[i].expiry = e.target.value; updateSos('pharmacy', np); }} className="bg-transparent text-white font-mono text-[10px] outline-none flex-1" />
                                         </div>
                                         <input value={p.location} onChange={e => { const np = [...state.sos.pharmacy]; np[i].location = e.target.value; updateSos('pharmacy', np); }} placeholder="Ort" className="bg-transparent text-white outline-none text-[10px] border-b border-[#333]" />
                                     </div>
                                     <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#222]">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => { const np = [...state.sos.pharmacy]; np[i].quantity = Math.max(0, np[i].quantity-1); updateSos('pharmacy', np); }} className="px-2 bg-[#222] text-white rounded font-black">-</button>
                                            <span className="font-mono text-white text-sm font-black w-6 text-center">{p.quantity}</span>
                                            <button onClick={() => { const np = [...state.sos.pharmacy]; np[i].quantity++; updateSos('pharmacy', np); }} className="px-2 bg-[#222] text-white rounded font-black">+</button>
                                        </div>
                                        <select value={p.unit} onChange={e => { const np = [...state.sos.pharmacy]; np[i].unit = e.target.value; updateSos('pharmacy', np); }} className="bg-transparent text-white text-[10px] font-black uppercase outline-none">
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

  const categories = ["Küche", "Garage", "Technik", "Wohnen", "Bad"];

  const filteredItems = state.inventory.filter((item: any) => 
    item.category === activeCategory && 
    (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     item.subcategory.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedBySub = useMemo(() => {
    const groups: Record<string, InventoryItem[]> = {};
    (state.subcategories[activeCategory] || []).forEach((sub:any) => groups[sub] = []);
    groups["Unkategorisiert"] = [];
    
    filteredItems.forEach((item: any) => {
        if (groups[item.subcategory]) groups[item.subcategory].push(item);
        else groups["Unkategorisiert"].push(item);
    });
    return groups;
  }, [filteredItems, activeCategory, state.subcategories]);

  return (
    <div className="space-y-6">
      <ViewTitle right={<button onClick={() => window.print()} className="p-2 border border-[#3a3a3a] rounded text-white hover:text-[#FF6600]"><Printer size={16}/></button>}>Inventar</ViewTitle>

      <div className="relative no-print">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white" size={14} />
        <input type="text" placeholder="BESTAND DURCHSUCHEN..." className="w-full bg-[#2C2E30] border border-[#3d3d3d] text-white pl-10 pr-4 py-3 rounded text-[10px] uppercase font-bold outline-none focus:border-[#FF6600]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 no-print flex-nowrap min-w-full">
        {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded border text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${activeCategory === cat ? 'bg-[#FF6600] border-[#FF6600] text-black' : 'bg-[#2C2E30] border-[#3d3d3d] text-white'}`}>
                {cat}
            </button>
        ))}
      </div>

      <div className="space-y-4 print-only print-table">
      {(state.subcategories[activeCategory] || []).map((sub: string) => (
          <div key={sub} className="mb-4">
              <div className="flex justify-between items-baseline border-b border-[#3d3d3d] pb-1 mb-2">
                  <h3 className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.2em]">{sub}</h3>
                  <span className="text-[9px] text-white font-mono uppercase">{(groupedBySub[sub] || []).length} Posten</span>
              </div>
              <table className="w-full text-left text-xs mb-4">
                  <tbody>
                  {(groupedBySub[sub] || []).map((item:any) => (
                      <tr key={item.id} className="border-b border-[#3d3d3d]/50">
                          <td className="py-2 text-white font-bold">{item.name}</td>
                          <td className="py-2 text-right"><span className="text-[#FF6600] font-mono font-black">{item.quantity}</span> <span className="text-[8px] text-white uppercase">{item.unit}</span></td>
                          <td className="py-2 text-right w-8 no-print"><button onClick={() => setState({...state, inventory: state.inventory.filter((i:any) => i.id !== item.id)})} className="text-white hover:text-red-500"><Trash2 size={12} /></button></td>
                      </tr>
                  ))}
                  </tbody>
              </table>
          </div>
      ))}
      </div>

      <div className="flex gap-3 no-print pt-4">
          <button onClick={() => setIsAddingSub(true)} className="flex-1 border border-dashed border-[#444] text-white p-3 rounded flex items-center justify-center gap-2 text-[10px] font-black uppercase"><Plus size={14} /> Gruppe</button>
          <button onClick={() => setIsAddingItem(true)} className="flex-[2] bg-[#FF6600] text-black font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 rounded"><Plus size={16} /> Artikel</button>
      </div>

      <AnimatePresence>
        {isAddingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="bg-[#2C2E30] w-full max-w-sm rounded border border-[#3d3d3d] p-6 space-y-4">
                    <h2 className="text-sm font-black text-[#FF6600] mb-4 uppercase">Neuer Artikel</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const fd = new FormData(e.target);
                        const newItem = { id: Date.now().toString(), name: fd.get('name') as string, quantity: parseFloat(fd.get('qty') as string), unit: fd.get('unit') as any, category: activeCategory, subcategory: fd.get('sub') as string };
                        setState({...state, inventory: [...state.inventory, newItem]});
                        setIsAddingItem(false);
                    }}>
                        <div className="space-y-3">
                            <input name="name" required placeholder="Name" className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-white" />
                            <div className="flex gap-3">
                                <input name="qty" required type="number" step="0.1" placeholder="Menge" className="flex-1 bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-white" />
                                <select name="unit" className="w-1/3 bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm"><option value="stk">Stk</option><option value="kg">kg</option><option value="g">g</option></select>
                            </div>
                            <select name="sub" className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm">
                                <option value="Unkategorisiert">Gruppe wählen...</option>
                                {(state.subcategories[activeCategory] || []).map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsAddingItem(false)} className="flex-1 py-3 font-black uppercase text-[10px] text-white tracking-widest border border-white rounded">Abbrechen</button><button type="submit" className="flex-1 bg-[#FF6600] text-black font-black rounded uppercase text-[10px] tracking-widest">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="bg-[#2C2E30] w-full max-w-sm rounded border border-[#3d3d3d] p-6 space-y-4">
                    <h2 className="text-sm font-black text-[#FF6600] mb-4 uppercase">Neue Gruppe</h2>
                    <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Name" className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-white" />
                    <div className="flex gap-3 pt-4"><button onClick={() => setIsAddingSub(false)} className="flex-1 py-3 text-white uppercase text-[10px] tracking-widest font-black border border-white rounded">Stop</button><button onClick={() => { if(newSubName){ setState({...state, subcategories: {...state.subcategories, [activeCategory]: [...(state.subcategories[activeCategory]||[]), newSubName]}}); setNewSubName(""); setIsAddingSub(false); } }} className="flex-1 bg-[#FF6600] text-black font-black rounded text-[10px] uppercase tracking-widest">Okay</button></div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- TAB: LOGBUCH ---

const CURRENCIES: Currency[] = ['EUR', 'CHF', 'TRY', 'HRK', 'DKK', 'SEK', 'NOK', 'PLN', 'GBP'];
const FUEL_TYPES: FuelType[] = ['Diesel', 'Benzin', 'Super E10', 'Super E5', 'AdBlue'];

function LogbuchView({ state, setState }: any) {
  const [logType, setLogType] = useState<'tank' | 'fahrt' | 'spots' | 'archiv'>('tank');
  const [isAdding, setIsAdding] = useState(false);

  const lastKmFuel = state.fuelLog.reduce((max: number, f: any) => Math.max(max, f.km), 0);
  const lastKmTrip = state.tripLog.reduce((max: number, t: any) => Math.max(max, t.toKm), 0);
  const lastKm = Math.max(lastKmFuel, lastKmTrip);

  const [tankForm, setTankForm] = useState({ date: new Date().toISOString().split('T')[0], km: '', liters: '', price: '', total: '', fuelType: 'Diesel', currency: 'EUR' });
  const [tourForm, setTourForm] = useState({ date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', destination: '', purpose: '' });
  const [spotForm, setSpotForm] = useState({ name: '', date: new Date().toISOString().split('T')[0], lat: '', lng: '', note: '' });

  const handleTankChange = (e: any) => {
      const { name, value } = e.target;
      setTankForm(prev => {
          const next = { ...prev, [name]: value };
          if (name === 'liters' || name === 'price') {
              const l = parseFloat(next.liters.replace(',', '.'));
              const p = parseFloat(next.price.replace(',', '.'));
              if (!isNaN(l) && !isNaN(p)) next.total = (l * p).toFixed(2);
          } else if (name === 'total') {
              const t = parseFloat(next.total.replace(',', '.'));
              const l = parseFloat(next.liters.replace(',', '.'));
              if (!isNaN(t) && !isNaN(l) && l > 0) next.price = (t / l).toFixed(3);
          }
          return next;
      });
  };

  const tourKmInvalid = tourForm.toKm !== '' && parseFloat(tourForm.toKm) < lastKm;

  const currentYear = new Date().getFullYear();
  const currentFuelLog = useMemo(() => state.fuelLog.filter((f:any) => new Date(f.date).getFullYear() === currentYear), [state.fuelLog, currentYear]);
  const currentTripLog = useMemo(() => state.tripLog.filter((t:any) => new Date(t.date).getFullYear() === currentYear), [state.tripLog, currentYear]);
  
  const totalLiters = currentFuelLog.reduce((acc:number, f:any) => acc + f.liters, 0);
  const totalEur = currentFuelLog.reduce((acc:number, f:any) => acc + (f.liters * f.price / (f.exchangeRateToEur || 1)), 0);
  const totalKm = currentTripLog.reduce((acc:number, t:any) => acc + (t.toKm - t.fromKm), 0);

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
    <div className="space-y-6">
      <ViewTitle right={<button onClick={() => window.print()} className="p-2 border border-[#3a3a3a] rounded text-white hover:text-[#FF6600]"><Printer size={16}/></button>}>Logbuch {currentYear}</ViewTitle>

      <div className="bg-[#FF6600] p-3 rounded-lg flex justify-between items-center text-black shadow-lg sticky top-[-10px] z-20">
          <div className="text-center">
              <div className="text-[9px] font-black uppercase tracking-widest">Jahres-KM</div>
              <div className="font-mono font-black text-sm">{formatNumber(totalKm, 0)}</div>
          </div>
          <div className="text-center">
              <div className="text-[9px] font-black uppercase tracking-widest">Liter</div>
              <div className="font-mono font-black text-sm">{formatNumber(totalLiters, 1)}</div>
          </div>
          <div className="text-center">
              <div className="text-[9px] font-black uppercase tracking-widest">Kosten</div>
              <div className="font-mono font-black text-sm">{formatNumber(totalEur, 2)}€</div>
          </div>
      </div>

      <div className="flex p-1 bg-[#111] rounded border border-[#3d3d3d] overflow-x-auto hide-scrollbar">
        {['tank', 'fahrt', 'spots', 'archiv'].map(t => (
            <button key={t} onClick={() => setLogType(t as any)} className={`flex-1 py-3 px-3 rounded text-[9px] font-black uppercase tracking-widest transition-all ${logType === t ? 'bg-[#2C2E30] text-[#FF6600] border border-[#FF6600]/50' : 'text-white hover:text-[#FF6600]'}`}>
                {t}
            </button>
        ))}
      </div>

      {logType === 'tank' && (
          <div className="space-y-3">
            {currentFuelLog.map((entry:any) => {
                const eurPrice = entry.price / (entry.exchangeRateToEur || 1);
                return (
                    <Card key={entry.id} className="flex justify-between items-center border-l-2 border-l-[#FF6600]">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-white font-black font-mono">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                            <span className="font-bold text-sm text-white tracking-tight">{formatNumber(entry.km, 0)} <span className="text-[10px] text-white font-black">KM</span></span>
                            <span className="text-[9px] text-[#FF6600] font-black uppercase mt-1 px-1 bg-[#FF6600]/10 rounded">{entry.fuelType}</span>
                        </div>
                        <div className="text-right">
                            <div className="font-black text-[#FF6600] text-lg">{formatNumber(entry.liters, 1)}<span className="text-[10px] text-white ml-0.5">L</span></div>
                            <div className="text-[10px] text-white font-bold uppercase tracking-tighter">
                                {formatNumber(entry.price, 2)} {entry.currency}/L <span className="text-white font-black">({formatNumber(eurPrice, 2)} €)</span>
                            </div>
                        </div>
                    </Card>
                );
            })}
          </div>
      )}

      {logType === 'fahrt' && (
          <div className="space-y-3">
              {currentTripLog.map((entry:any) => (
                  <Card key={entry.id} className="space-y-4 border-l-2 border-l-[#FF6600]">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-white font-black font-mono">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                            <h4 className="font-black text-[#FF6600] uppercase tracking-tight">{entry.destination}</h4>
                            <p className="text-[10px] text-white font-medium italic">{entry.purpose}</p>
                        </div>
                        <div className="bg-[#FF6600]/10 text-[#FF6600] px-3 py-1 rounded text-[10px] font-black font-mono">
                            +{formatNumber(entry.toKm - entry.fromKm, 0)} KM
                        </div>
                    </div>
                  </Card>
              ))}
          </div>
      )}

      {logType === 'spots' && (
          <div className="space-y-3">
              {state.spots.map((spot:any) => (
                  <Card key={spot.id} className="border-l-2 border-l-blue-500">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-white font-black font-mono">{new Date(spot.date).toLocaleDateString('de-DE')}</span>
                         <h4 className="font-bold text-white tracking-tight">{spot.name}</h4>
                         <p className="text-xs text-white italic mt-1 font-bold">{spot.note}</p>
                         <a href={`geo:${spot.lat},${spot.lng}`} className="text-blue-500 text-[10px] font-black mt-2 uppercase flex items-center gap-1"><MapPin size={12}/> {spot.lat.toFixed(4)} / {spot.lng.toFixed(4)}</a>
                      </div>
                  </Card>
              ))}
              {state.spots.length > 0 && (
                  <button onClick={() => {
                      let gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="CamperGuard Pro">`;
                      state.spots.forEach((spot:any) => {
                          gpx += `<wpt lat="${spot.lat}" lon="${spot.lng}"><name>${spot.name}</name><desc>${spot.note}</desc></wpt>`;
                      });
                      gpx += `</gpx>`;
                      const blob = new Blob([gpx], { type: 'application/gpx+xml' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `Tour_${new Date().toISOString().split('T')[0]}_Spots.gpx`;
                      a.click();
                  }} className="w-full bg-[#111] text-white py-3 border border-[#3d3d3d] rounded text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 mt-4"><FileDown size={14}/> GPX Export</button>
              )}
          </div>
      )}

      {logType === 'archiv' && (
          <div className="space-y-4">
              {state.archives.map((a:any) => (
                  <Card key={a.year} className="bg-[#222]">
                      <h3 className="text-[#FF6600] font-black tracking-widest border-b border-[#3d3d3d] pb-2 mb-2 flex items-center gap-2"><Archive size={14}/> {a.year}</h3>
                      <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                              <div className="text-[9px] text-white uppercase font-black">Distanz</div>
                              <div className="font-mono text-xs text-white font-black">{formatNumber(a.totalKm, 0)} KM</div>
                          </div>
                          <div>
                              <div className="text-[9px] text-white uppercase font-black">Liter</div>
                              <div className="font-mono text-xs text-white font-black">{formatNumber(a.totalLiters, 1)} L</div>
                          </div>
                          <div>
                              <div className="text-[9px] text-white uppercase font-black">Kosten</div>
                              <div className="font-mono text-xs text-[#FF6600] font-black">{formatNumber(a.totalEur, 2)} €</div>
                          </div>
                      </div>
                  </Card>
              ))}
              {state.archives.length === 0 && <div className="text-center text-white text-xs py-8 font-black uppercase tracking-widest">Keine Archive</div>}
          </div>
      )}

      {logType !== 'archiv' && (
         <div className="pt-4 flex gap-2">
             {logType === 'tank' && <button onClick={closeYear} className="px-4 py-3 bg-[#333] text-white text-[10px] font-black uppercase tracking-widest rounded flex items-center gap-2 border border-[#444]"><Archive size={14}/> Jahr Abschließen</button>}
             <button onClick={() => setIsAdding(true)} className="flex-1 bg-[#FF6600] text-black py-3 rounded text-[10px] font-black uppercase flex items-center justify-center gap-2"><Plus size={16} /> Eintrag</button>
         </div>
      )}

      <AnimatePresence>
        {isAdding && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-[#2C2E30] w-full max-w-sm rounded border border-[#3d3d3d] p-6 space-y-4 my-8">
                    <h2 className="text-sm font-black text-[#FF6600] mb-4 uppercase">{logType === 'tank' ? 'Tankbeleg' : logType === 'fahrt' ? 'Fahrt-Eintrag' : 'Spot Log'}</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const fd = new FormData(e.target);
                        if(logType === 'tank') {
                            const cur = fd.get('currency') as Currency;
                            const rate = state.exchangeRates[cur] || 1;
                            const entry: FuelEntry = { id: Date.now().toString(), date: fd.get('date') as string, km: parseFloat(fd.get('km') as string), liters: parseFloat(fd.get('liters') as string), price: parseFloat(fd.get('price') as string), currency: cur, exchangeRateToEur: rate, fuelType: fd.get('fuelType') as FuelType };
                            setState({...state, fuelLog: [entry, ...state.fuelLog]});
                        } else if(logType === 'fahrt') {
                            const entry: TripEntry = { id: Date.now().toString(), date: fd.get('date') as string, fromKm: parseFloat(fd.get('fromKm') as string), toKm: parseFloat(fd.get('toKm') as string), purpose: fd.get('purpose') as string, destination: fd.get('destination') as string };
                            setState({...state, tripLog: [entry, ...state.tripLog]});
                        } else if(logType === 'spots') {
                            const entry: SpotEntry = { id: Date.now().toString(), name: fd.get('name') as string, date: fd.get('date') as string, lat: parseFloat(fd.get('lat') as string), lng: parseFloat(fd.get('lng') as string), note: fd.get('note') as string };
                            setState({...state, spots: [entry, ...state.spots]});
                        }
                        setIsAdding(false);
                    }}>
                        <div className="space-y-3">
                            <input name="date" required type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-white" />
                            
                            {logType === 'tank' ? (
                                <>
                                    <input name="km" value={tankForm.km} onChange={handleTankChange} required type="number" placeholder="KM-Stand" className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500" />
                                    <div className="flex gap-2">
                                        <input name="liters" value={tankForm.liters} onChange={handleTankChange} required type="number" step="0.01" placeholder="Liter" className="flex-1 bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500" />
                                        <select name="fuelType" value={tankForm.fuelType} onChange={handleTankChange} className="w-1/2 bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm text-[10px] uppercase font-black">
                                            {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <input name="price" value={tankForm.price} onChange={handleTankChange} required type="number" step="0.001" placeholder="Preis/Liter" className="flex-1 bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500" />
                                        <input name="total" value={tankForm.total} onChange={handleTankChange} type="number" step="0.01" placeholder="Gesamt €" className="flex-1 bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500" />
                                        <select name="currency" className="w-[80px] bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm font-mono font-black">
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </>
                            ) : logType === 'fahrt' ? (
                                <>
                                    <div className="flex gap-2">
                                        <input name="fromKm" value={tourForm.fromKm} onChange={e => setTourForm({...tourForm, fromKm: e.target.value})} required type="number" placeholder={`Start KM (Letzter: ${lastKm})`} className={`w-1/2 bg-[#111] border text-white p-3 rounded text-sm placeholder:text-gray-500 ${tourForm.fromKm !== '' && parseFloat(tourForm.fromKm) < lastKm ? 'border-red-500 text-red-500' : 'border-[#3d3d3d]'}`} />
                                        <input name="toKm" value={tourForm.toKm} onChange={e => setTourForm({...tourForm, toKm: e.target.value})} required type="number" placeholder={`Ziel KM (Letzter: ${lastKm})`} className={`w-1/2 bg-[#111] border text-white p-3 rounded text-sm placeholder:text-gray-500 ${tourKmInvalid ? 'border-red-500 text-red-500' : 'border-[#3d3d3d]'}`} />
                                    </div>
                                    <input name="destination" value={tourForm.destination} onChange={e => setTourForm({...tourForm, destination: e.target.value})} required placeholder="Zielort" className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500" />
                                    <input name="purpose" value={tourForm.purpose} onChange={e => setTourForm({...tourForm, purpose: e.target.value})} placeholder="Zweck" className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500" />
                                </>
                            ) : (
                                <>
                                    <input name="name" value={spotForm.name} onChange={e => setSpotForm({...spotForm, name: e.target.value})} required placeholder="Spot Name" className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500" />
                                    <div className="flex gap-2 items-center">
                                        <button type="button" onClick={async () => {
                                            try { const p = await getPosition(); setSpotForm({...spotForm, lat: p.lat.toString(), lng: p.lng.toString()}); } catch(err){ alert("GPS failed"); }
                                        }} className="p-3 bg-blue-500 text-white rounded border border-blue-400 font-black"><MapPin size={18}/></button>
                                        <input name="lat" value={spotForm.lat} onChange={e => setSpotForm({...spotForm, lat: e.target.value})} required type="number" step="any" placeholder="Lat" className="w-1/2 bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500" />
                                        <input name="lng" value={spotForm.lng} onChange={e => setSpotForm({...spotForm, lng: e.target.value})} required type="number" step="any" placeholder="Lng" className="w-1/2 bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500" />
                                    </div>
                                    <textarea name="note" value={spotForm.note} onChange={e => setSpotForm({...spotForm, note: e.target.value})} placeholder="Notiz" className="w-full bg-[#111] border border-[#3d3d3d] text-white p-3 rounded text-sm h-24 placeholder:text-gray-500" />
                                </>
                            )}
                        </div>
                        <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 text-white uppercase text-[10px] tracking-widest font-black border border-white rounded">Abbrechen</button><button type="submit" disabled={logType === 'fahrt' && (tourKmInvalid || (tourForm.fromKm !== '' && parseFloat(tourForm.fromKm) < lastKm))} className="flex-1 bg-[#FF6600] disabled:opacity-50 text-black font-black uppercase text-[10px] tracking-widest rounded">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
// --- TAB: REISE ---

function ReiseView({ state, setState }: any) {
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

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

  const range = ((state.profile.fuelCapacity || 80) / avgConsumption) * 100;

  const MapHandler = () => {
    useMapEvents({
      click(e) {
        setDestination([e.latlng.lat, e.latlng.lng]);
        setDistance(Math.floor(Math.random() * (range * 0.8)) + 50); // dummy dist
      },
    });
    return destination ? <Marker position={destination} /> : null;
  };

  const ResizeMap = () => {
    const map = useMap();
    useEffect(() => {
      globalLeafletMap = map;
      return () => { globalLeafletMap = null; };
    }, [map]);
    return null;
  };

  const isCritical = distance ? distance > range : false;

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-140px)]">
      <ViewTitle>Reiseplaner</ViewTitle>
      
      <Card className="p-0 overflow-hidden relative border-[#3d3d3d] z-0 flex-1 min-h-[400px]">
          <MapContainer id="map" center={[51.1657, 10.4515]} zoom={6} zoomControl={false} style={{ height: '100%', width: '100%', background: '#111' }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <MapHandler />
            <ResizeMap />
          </MapContainer>
          <div className="absolute top-4 right-4 z-[400] bg-[#FF6600] text-black px-3 py-1.5 rounded font-black text-[10px] uppercase shadow-xl select-none pointer-events-none">Ziel wählen</div>
      </Card>

      <Card className="bg-gradient-to-b from-[#2C2E30] to-[#1A1C1E] space-y-4 no-print">
        <div className="flex justify-between items-center">
            <div>
                <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none block mb-1">Max. Reichweite</span>
                <span className="text-2xl font-black font-mono text-white">{formatNumber(range, 0)} <span className="text-xs text-white">KM</span></span>
            </div>
            {distance && (
                <div className="text-right">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none block mb-1">Distanz</span>
                    <span className={`text-2xl font-black font-mono ${isCritical ? 'text-red-500' : 'text-green-500'}`}>{formatNumber(distance, 0)} <span className="text-xs text-white">KM</span></span>
                </div>
            )}
        </div>

        {distance && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-3 rounded flex items-center justify-between transition-colors border ${isCritical ? 'bg-red-500 text-white border-red-400' : 'bg-green-500 text-white border-green-400'}`}>
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                    {isCritical ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                    <span>{isCritical ? "STOP: Tankstopp nötig!" : "LOS: Ziel erreichbar"}</span>
                </div>
                <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination?.[0]},${destination?.[1]}`, '_blank')} className="p-2 bg-black/20 hover:bg-black/40 rounded">
                    <Navigation size={16} className="text-white" />
                </button>
            </motion.div>
        )}
      </Card>
    </div>
  );
}

// --- TAB: PROFIL ---

const APP_FAQS = [
  { "id": 1, "kategorie": "Sicherheit & Gesundheit", "frage": "Warum ist das Ausfüllen der Medikationsdaten so wichtig?", "antwort": "Im Notfall zählt jede Sekunde. Rettungskräfte müssen sofort wissen, ob lebensnotwendige Medikamente (z. B. für Herz, Blutdruck oder Diabetes) eingenommen werden. Diese Daten sind im Safety Hub optisch hervorgehoben, damit sie auch unter Stress sofort gefunden werden." },
  { "id": 2, "kategorie": "Sicherheit & Gesundheit", "frage": "Was passiert mit meinen privaten Notfalldaten?", "antwort": "Datenschutz hat oberste Priorität. Alle Informationen im Safety Hub werden ausschließlich lokal auf deinem Gerät gespeichert. Es findet kein Cloud-Sync und keine Übertragung an Dritte statt. Du behältst die volle Kontrolle." },
  { "id": 3, "kategorie": "Sicherheit & Gesundheit", "frage": "Wofür ist der zweite Notfallkontakt (ICE 2) gedacht?", "antwort": "Sollte dein primärer Ansprechpartner nicht erreichbar sein, bietet CamperGuard Pro die Möglichkeit, eine zweite Vertrauensperson zu hinterlegen, um die Rettungskette lückenlos zu schließen." },
  { "id": 4, "kategorie": "Fahrzeug & Technik", "frage": "Warum sollte ich meine Fahrzeugdaten (Tachostand etc.) penibel pflegen?", "antwort": "Korrekte Fahrzeugdaten sind die Basis für alle Statistiken. Nur so kann die App den Durchschnittsverbrauch, die Kosten pro Kilometer und anstehende Service-Intervalle präzise berechnen und dich rechtzeitig warnen." },
  { "id": 5, "kategorie": "Fahrzeug & Technik", "frage": "Die Wasserwaage zeigt Heading und Elevation – was ist das?", "antwort": "Heading gibt deine aktuelle Kompassrichtung an, Elevation deine Höhe über dem Meeresspiegel. Das hilft dir nicht nur beim perfekten Ausrichten für den Satellitenempfang, sondern auch bei der Einschätzung von Wetterlagen in den Bergen." },
  { "id": 6, "kategorie": "Fahrzeug & Technik", "frage": "Wie funktioniert das akustische Feedback beim Ausrichten?", "antwort": "Ein kontinuierliches Brummen signalisiert die Annäherung an die Waagerechte. Ein klarer 'Success-Chime' ertönt genau bei 0.0°, sodass du das Fahrzeug leveln kannst, ohne das Display im Blick behalten zu müssen." },
  { "id": 7, "kategorie": "Inventar & Lagerorte", "frage": "Wie organisiere ich meine Ausrüstung in 'Lagerorten'?", "antwort": "Statt einer langen, unübersichtlichen Liste kannst du Bereiche wie 'Heckgarage', 'Küchenzeile' oder 'Außenstaufach' anlegen. Jedem Gegenstand können zudem zwei spezifische Standorte zugewiesen werden (z. B. 'Schublade oben')." },
  { "id": 8, "kategorie": "Inventar & Lagerorte", "frage": "Was bedeutet die Bestandsmenge '0' im Inventar?", "antwort": "Ein Bestand von '0' markiert Verbrauchsartikel, die aktuell aufgebraucht sind, aber zur Standardausrüstung gehören. So vergisst du beim nächsten Einkauf nicht, wichtige Vorräte oder Gaskartuschen nachzufüllen." },
  { "id": 9, "kategorie": "Logbuch & Tanken", "frage": "Warum ist das Feld beim Kilometerstand rot markiert?", "antwort": "Das ist eine Sicherheitsfunktion. Wenn du einen Kilometerstand eingibst, der unter dem letzten gespeicherten Wert liegt, wird das Feld rot und die Speicherung blockiert, um Tacho-Fehler in deiner Statistik zu vermeiden." },
  { "id": 10, "kategorie": "Logbuch & Tanken", "frage": "Wie rechnet die App den Spritpreis aus, wenn ich nur Liter und Gesamtbetrag habe?", "antwort": "Gib einfach die Liter und den Gesamtpreis vom Kassenbon ein. Die App erkennt die fehlende Information automatisch und errechnet den Literpreis für dich nach (2-aus-3-Regel)." },
  { "id": 11, "kategorie": "Logbuch & Tanken", "frage": "Was passiert mit Touren, wenn ich sie archiviere?", "antwort": "Archivierte Touren werden schreibgeschützt in einen separaten Bereich verschoben. Das hält deine aktuelle Tour-Liste übersichtlich, bewahrt aber alle Kosten und Route-Daten für spätere Auswertungen auf." },
  { "id": 12, "kategorie": "Karten & Navigation", "frage": "Wie kann ich meine aktuellen Koordinaten für einen POI speichern?", "antwort": "Klicke im POI-Modul einfach auf das Fadenkreuz-Symbol. Die App liest deine exakte GPS-Position aus und fügt Längen- und Breitengrad direkt in den Eintrag ein. GPS muss dafür am Gerät aktiviert sein." },
  { "id": 13, "kategorie": "Karten & Navigation", "frage": "Was bringt mir der GPX-Export?", "antwort": "Mit dem GPX-Export kannst du deine gesammelten POIs und Routen als Datei speichern und in Profi-Navis (Garmin, TomTom) oder Planungs-Tools wie Google Earth importieren." },
  { "id": 14, "kategorie": "Karten & Navigation", "frage": "Warum sehe ich auf der Karte nur schwarze Kacheln?", "antwort": "Dies kann bei langsamer Internetverbindung oder nach einem Displaywechsel (z. B. beim Aufklappen des Z-Fold) passieren. Die App führt nach 200ms automatisch eine Neuausrichtung (Re-Render) durch, um die Karte korrekt anzuzeigen." },
  { "id": 15, "kategorie": "System & Bedienung", "frage": "Ist die App auf Tablets anders aufgebaut?", "antwort": "Ja, auf Geräten ab 10 Zoll nutzt CamperGuard Pro ein Zwei-Spalten-Layout, um mehr Informationen gleichzeitig anzuzeigen und die Bedienung komfortabler zu machen." },
  { "id": 16, "kategorie": "System & Bedienung", "frage": "Kann ich die App auch ohne Internetverbindung nutzen?", "antwort": "Absolut. Alle Kernfunktionen (Logbuch, Inventar, Safety Hub, Wasserwaage) sind voll offline-fähig. Lediglich für das Laden neuer Kartenkacheln ist eine kurze Online-Verbindung nötig." },
  { "id": 17, "kategorie": "System & Bedienung", "frage": "Warum ist das Logo auf meinen Ausdrucken unten links?", "antwort": "Dies dient der professionellen Dokumentation und dem Branding deiner Reiseunterlagen. So sehen Export-Berichte (z. B. für die Versicherung oder das Fahrtenbuch) immer offiziell und strukturiert aus." },
  { "id": 18, "kategorie": "Inventar & Lagerorte", "frage": "Kann ich Lagerorte nachträglich umbenennen?", "antwort": "Ja, durch einfaches Antippen des Namens im Edit-Modus kannst du jeden Bereich (z. B. von 'Küche' zu 'Pantry') individuell anpassen." },
  { "id": 19, "kategorie": "Sicherheit & Gesundheit", "frage": "Was bedeutet der GPS-Toggle im Safety Hub?", "antwort": "Damit kannst du die GPS-Ortung manuell komplett ausschalten. Das schont den Akku und schützt deine Privatsphäre, wenn du keine Standort-Daten in deinen Notfall-Profilen anzeigen möchtest." },
  { "id": 20, "kategorie": "Logbuch & Tanken", "frage": "Was trage ich im Feld 'Zweck' bei einer Tour ein?", "antwort": "Das Feld ist ein Freitextfeld. Du kannst dort Notizen wie 'Urlaub Schweden', 'Werkstattbesuch' oder 'Testfahrt nach Umbau' hinterlegen, um deine Touren im Archiv besser zu unterscheiden." }
];

function ProfilView({ state, setState, demoSeed }: any) {
  const [activeTireProfile, setActiveTireProfile] = useState<TireProfile>('Straße');
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');

  const hc = (path: string, val: any) => {
    setState((prev:any) => {
        const next = {...prev};
        const p = path.split('.');
        let c = next;
        for(let i=0; i<p.length-1; i++) c = c[p[i]];
        c[p[p.length-1]] = val;
        return next;
    });
  };

  const tp = state.profile.tires[activeTireProfile] || { frontLeft:0, frontRight:0, rearLeft:0, rearRight:0 };
  const TIRE_PROFILES: TireProfile[] = ['Straße', 'Sand/Dünen', 'Schlamm/Matsch', 'Felsgelände', 'Geröll/Schotter', 'Wasser/Furten', 'Schnee/Eis', 'Erde/Wiese'];

  return (
    <div className="space-y-6 pb-12">
      <ViewTitle right={<button onClick={() => setShowFaqModal(true)} className="text-[10px] font-black uppercase text-white border border-white px-2 py-1 rounded">FAQ</button>}>Vehicle</ViewTitle>
      
      <Card className="space-y-4">
          <div><label className="text-[10px] font-black text-white uppercase tracking-widest block mb-2">Camper Name</label><input value={state.profile.vehicleName} onChange={e => hc('profile.vehicleName', e.target.value)} placeholder="Spitzname..." className="w-full bg-[#111] border border-[#3d3d3d] rounded p-3 text-white font-bold placeholder:text-white" /></div>
          <div><label className="text-[10px] font-black text-white uppercase tracking-widest block mb-2">Kennzeichen</label><input value={state.profile.plate} onChange={e => hc('profile.plate', e.target.value)} placeholder="B-CG 77" className="w-full bg-[#111] border border-[#3d3d3d] rounded p-3 text-white uppercase font-mono tracking-widest placeholder:text-white" /></div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
          {[ { l: 'H', k: 'height', u: 'm' }, { l: 'B', k: 'width', u: 'm' }, { l: 'L', k: 'length', u: 'm' } ].map(d => (
              <Card key={d.k} className="p-3 text-center">
                  <span className="text-[9px] font-black text-white uppercase block mb-1">{d.l} ({d.u})</span>
                  <input type="number" step="0.01" value={state.profile[d.k]} onChange={e => hc(`profile.${d.k}`, parseFloat(e.target.value))} className="w-full bg-transparent text-center font-mono font-black text-sm outline-none border-b border-[#444] py-1 text-white" />
              </Card>
          ))}
      </div>

      <Card className="space-y-4">
          <div className="flex justify-between items-center bg-[#111] p-3 rounded border border-[#3d3d3d]">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Leergewicht / zGG</span>
              <div className="flex items-center gap-1 font-mono font-black">
                <input type="number" value={state.profile.emptyWeight} onChange={e => hc('profile.emptyWeight', parseFloat(e.target.value))} className="w-16 bg-transparent text-right outline-none text-xs text-white" />
                <span className="text-white">/</span>
                <input type="number" value={state.profile.maxWeight} onChange={e => hc('profile.maxWeight', parseFloat(e.target.value))} className="w-16 bg-transparent outline-none text-xs text-[#FF6600]" />
                <span className="text-[8px] text-white">KG</span>
              </div>
          </div>
          
          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-black text-white uppercase tracking-widest block mb-2">Wartungs-Termine</span>
            {state.maintenance.map((m:any, idx:number) => (
                <div key={m.id} className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-white w-20 uppercase tracking-tighter leading-tight">{m.name}</span>
                    <input type="date" value={m.date} onChange={(e) => { const nm = [...state.maintenance]; nm[idx].date = e.target.value; setState({...state, maintenance: nm}); }} className="flex-1 bg-[#111] border border-[#3d3d3d] p-2 rounded text-white font-mono text-xs text-white" />
                </div>
            ))}
          </div>
      </Card>

      <Card className="space-y-4 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-center">
             <span className="text-[10px] font-black text-white uppercase tracking-widest">Reifendruck (bar)</span>
             <button onClick={() => hc('profile.isTwinTires', !state.profile.isTwinTires)} className={`text-[9px] px-2 py-1 rounded font-black tracking-widest uppercase border transition-colors ${state.profile.isTwinTires ? 'bg-blue-500 text-white border-blue-500' : 'border-white text-white'}`}>+ ZWILLING</button>
          </div>
          
          <select value={activeTireProfile} onChange={e => setActiveTireProfile(e.target.value as any)} className="w-full bg-[#111] text-white border border-[#3d3d3d] p-2 rounded text-[10px] font-black tracking-widest uppercase text-white">
              {TIRE_PROFILES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          
          <div className="grid grid-cols-2 gap-4 pt-2 relative">
             <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[#333] -translate-x-1/2"/>
             <div className="absolute left-0 right-0 top-1/2 h-px bg-[#333] -translate-y-1/2"/>
             
             {/* FRONT LEFT */}
             <div className="flex flex-col items-center">
                 <span className="text-[8px] text-white font-black uppercase mb-1">VL {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                 <input type="number" step="0.1" value={tp.frontLeft} onChange={e => hc(`profile.tires.${activeTireProfile}.frontLeft`, parseFloat(e.target.value))} className="w-16 bg-[#111] border border-[#444] rounded text-center text-xs font-mono font-black text-white py-1" />
             </div>
             {/* FRONT RIGHT */}
             <div className="flex flex-col items-center">
                 <span className="text-[8px] text-white font-black uppercase mb-1">VR {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                 <input type="number" step="0.1" value={tp.frontRight} onChange={e => hc(`profile.tires.${activeTireProfile}.frontRight`, parseFloat(e.target.value))} className="w-16 bg-[#111] border border-[#444] rounded text-center text-xs font-mono font-black text-white py-1" />
             </div>
             {/* REAR LEFT */}
             <div className="flex flex-col items-center">
                 <span className="text-[8px] text-white font-black uppercase mb-1">HL {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                 <input type="number" step="0.1" value={tp.rearLeft} onChange={e => hc(`profile.tires.${activeTireProfile}.rearLeft`, parseFloat(e.target.value))} className="w-16 bg-[#111] border border-[#444] rounded text-center text-xs font-mono font-black text-white py-1" />
                 {state.profile.isTwinTires && (
                    <>
                        <span className="text-[8px] text-white font-black uppercase mb-1 mt-2">HL (Außen)</span>
                        <input type="number" step="0.1" value={tp.rearLeftOuter || tp.rearLeft} onChange={e => hc(`profile.tires.${activeTireProfile}.rearLeftOuter`, parseFloat(e.target.value))} className="w-16 bg-[#111] border border-[#444] rounded text-center text-xs font-mono font-black text-[#FF6600] py-1" />
                    </>
                 )}
             </div>
             {/* REAR RIGHT */}
             <div className="flex flex-col items-center">
                 <span className="text-[8px] text-white font-black uppercase mb-1">HR {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                 <input type="number" step="0.1" value={tp.rearRight} onChange={e => hc(`profile.tires.${activeTireProfile}.rearRight`, parseFloat(e.target.value))} className="w-16 bg-[#111] border border-[#444] rounded text-center text-xs font-mono font-black text-white py-1" />
                 {state.profile.isTwinTires && (
                    <>
                        <span className="text-[8px] text-white font-black uppercase mb-1 mt-2">HR (Außen)</span>
                        <input type="number" step="0.1" value={tp.rearRightOuter || tp.rearRight} onChange={e => hc(`profile.tires.${activeTireProfile}.rearRightOuter`, parseFloat(e.target.value))} className="w-16 bg-[#111] border border-[#444] rounded text-center text-xs font-mono font-black text-[#FF6600] py-1" />
                    </>
                 )}
             </div>
          </div>
      </Card>

      <div className="flex flex-col gap-3 pt-6">
        <button onClick={demoSeed} className="w-full bg-blue-500 text-white py-4 rounded font-black text-[10px] uppercase tracking-widest shadow-lg">Demo Reset</button>
        <button onClick={() => { if(confirm("LÖSCHEN?")) { initDB().then(db=>db.clear('store')); window.location.reload(); } }} className="w-full bg-red-600 text-white py-4 rounded font-black text-[10px] uppercase tracking-widest shadow-lg">Full Wipe</button>
      </div>

      <AnimatePresence>
          {showFaqModal && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4">
                 <div className="flex justify-between items-center mb-4 pt-4"><h2 className="text-[#FF6600] font-black tracking-widest uppercase">CamperGuard FAQ</h2><button onClick={()=>setShowFaqModal(false)} className="text-white border px-3 py-1 rounded">X</button></div>
                 <input type="text" placeholder="Suche..." value={faqSearch} onChange={e => setFaqSearch(e.target.value)} className="w-full bg-[#2C2E30] border border-[#3d3d3d] text-white p-3 rounded text-sm placeholder:text-gray-500 mb-4" />
                 <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                     {APP_FAQS.filter(f => f.frage.toLowerCase().includes(faqSearch.toLowerCase()) || f.antwort.toLowerCase().includes(faqSearch.toLowerCase())).map((f:any) => (
                         <Card key={f.id} className="space-y-2">
                             <span className="text-[9px] text-[#FF6600] font-black uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded">{f.kategorie}</span>
                             <h4 className="text-sm font-bold text-white mt-1">{f.frage}</h4>
                             <p className="text-xs text-gray-300 leading-relaxed border-t border-[#3d3d3d] pt-2 mt-2">{f.antwort}</p>
                         </Card>
                     ))}
                     {APP_FAQS.filter(f => f.frage.toLowerCase().includes(faqSearch.toLowerCase()) || f.antwort.toLowerCase().includes(faqSearch.toLowerCase())).length === 0 && (
                         <div className="text-white text-center text-sm mt-8 opacity-50">Keine Ergebnisse gefunden.</div>
                     )}
                 </div>
             </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
