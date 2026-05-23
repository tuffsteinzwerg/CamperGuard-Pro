import { useEffect, useState } from 'react';
import type { AppState, InventoryItem, PharmacyItem, MaintenanceItem } from '../../types';
import { AlertTriangle, CheckCircle, Droplet, Fuel, Settings, ShieldCheck, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { formatNumber, formatWeight } from '../lib/formatters';
import { WeightGauge } from './status/WeightGauge';
import { DepartureChecklist } from './status/DepartureChecklist';

interface StatusViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  orientation: { pitch: number; roll: number; heading: number };
  showSos: boolean;
  setShowSos: (v: boolean) => void;
  sosTab: 'hilfe' | 'id' | 'inhalt';
  setSosTab: (t: 'hilfe' | 'id' | 'inhalt') => void;
}

export function StatusView({ state, setState, orientation, showSos, setShowSos, sosTab, setSosTab }: StatusViewProps) {
  const [gpsAlt, setGpsAlt] = useState<number|null>(null);
  const [gpsCoords, setGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'offline'|'loading'|'active'>('offline');

  const pitchNormalized = Math.max(-20, Math.min(20, orientation.pitch));
  const rollNormalized = Math.max(-20, Math.min(20, orientation.roll));
  const heading = orientation.heading;
  
  const freshWaterLiters = (state.waterLevel / 100) * (state.profile.freshWaterCapacity || 0);
  const wasteWaterLiters = (state.wasteWaterLevel / 100) * (state.profile.wasteWaterCapacity || 0);
  const fuelLiters = (state.dieselLevel / 100) * (state.profile.dieselCapacity || 0);

  const waterWeightImpact = freshWaterLiters * 1;
  const wasteWaterWeight = wasteWaterLiters * 1;
  const dieselWeight = fuelLiters * 0.84;

  const inventoryWeight = (state.inventory || []).reduce((acc: number, item: InventoryItem) => {
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


  const warnings: { type: 'danger' | 'warn'; text: string; action?: 'pharmacy' }[] = [];
  if (remainingWeight < 0) {
      warnings.push({ type: 'danger', text: `Fahrzeug überladen! ${formatNumber(Math.abs(remainingWeight), 0)} kg über ZGG` });
  }
  const nowMs = new Date().getTime();
  (state.maintenance || []).forEach((m: MaintenanceItem) => {
      if (!m.date) return;
      const dateMs = new Date(m.date).getTime();
      const diffDays = (dateMs - nowMs) / (1000 * 3600 * 24);
      if (diffDays < 0) {
          warnings.push({ type: 'danger', text: `${m.name} überfällig seit ${new Date(m.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` });
      } else if (diffDays <= 30) {
          warnings.push({ type: 'warn', text: `${m.name} fällig am ${new Date(m.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` });
      }
  });

  // --- Medikamenten Ablauf Logik Start ---
  const expiredPharmacyItems: any[] = [];
  const soonExpiringPharmacyItems: any[] = [];
  (() => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      (state.sos?.pharmacy || []).forEach((p: PharmacyItem) => {
          if (!p || !p.name || String(p.name).trim() === '' || typeof p.expiry !== 'string' || !p.expiry) return;
          const parts = p.expiry.split('-');
          if (parts.length !== 2) return;
          const expYear = parseInt(parts[0], 10);
          const expMonth = parseInt(parts[1], 10);
          if (isNaN(expYear) || isNaN(expMonth)) return;
          const expiryDate = new Date(expYear, expMonth, 0);
          if (expiryDate < today) {
              expiredPharmacyItems.push(p);
          } else {
              const diffTime = expiryDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays <= 30) {
                  soonExpiringPharmacyItems.push(p);
              }
          }
      });
  })();
  if (expiredPharmacyItems.length > 0) {
      warnings.push({ type: 'danger', text: `${expiredPharmacyItems.length === 1 ? '1 Medikament abgelaufen' : `${expiredPharmacyItems.length} Medikamente abgelaufen`} - Safety Hub · Apotheke prüfen`, action: 'pharmacy' });
  }
  if (soonExpiringPharmacyItems.length > 0) {
      warnings.push({ type: 'warn', text: `${soonExpiringPharmacyItems.length === 1 ? '1 Medikament läuft bald ab' : `${soonExpiringPharmacyItems.length} Medikamente laufen bald ab`} - Safety Hub · Apotheke prüfen`, action: 'pharmacy' });
  }
  // --- Medikamenten Ablauf Logik Ende ---

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 pb-24 px-2 pt-4">


      <WeightGauge 
        totalWeight={totalWeight}
        remainingWeight={remainingWeight}
        state={state}
        setState={setState}
        waterWeightImpact={waterWeightImpact}
        wasteWaterWeight={wasteWaterWeight}
        dieselWeight={dieselWeight}
        inventoryWeight={inventoryWeight}
      />

      {/* Element 2: Warnbereich */}
      {warnings.length > 0 && (
          <div className="flex flex-col gap-3">
              {warnings.map((w: { type: string; text: string; action?: string }, idx: number) => (
                  <div 
                      key={idx} 
                      className={`card-alert alert-${w.type} flex items-center gap-3 cg-alert ${w.action ? 'cursor-pointer active:opacity-70' : ''}`}
                      onClick={() => {
                          if (w.action === 'pharmacy') {
                              setShowSos(true);
                              setSosTab('inhalt');
                          }
                      }}
                  >
                      <AlertTriangle size={18} />
                      <span className="cg-technical-label">{w.text}</span>
                      {w.action && <ChevronRight size={16} className="ml-auto opacity-50" />}
                  </div>
              ))}
          </div>
      )}

      {/* Element 6: Wartungstermine */}
      <div className="cg-panel p-4">
          <div className="typo-engraved mb-4">WARTUNG</div>
          <div className="grid grid-cols-2 gap-4">
              {(state.maintenance || []).map((item: InventoryItem) => {
                  const date = item.date ? new Date(item.date) : null;
                  const diffInDays = date ? (date.getTime() - new Date().getTime()) / (1000 * 3600 * 24) : 999;
                  const borderColor = diffInDays < 0 ? 'var(--status-danger)' : diffInDays < 60 ? 'var(--status-warn)' : 'rgba(255,255,255,0.05)';
                  return (
                      <div key={item.id} className="relative aspect-square w-full max-w-[120px] mx-auto rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90">
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                          <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                          <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                              <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                              <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c'} 0%, transparent 70%)` }} />
                              <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c', boxShadow: `0 -2px 8px ${item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c'}` }} />
                          </div>
                          <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-1">
                              <div className="text-[10px] uppercase font-bold tracking-widest text-[#8a939c] mb-[2px]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{item.name}</div>
                              <div className="text-[15px] font-bold tracking-wider text-white instrument-value mb-[4px]" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                                  {item.date ? new Date(item.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'}
                              </div>
                              <div style={{ color: item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c', filter: `drop-shadow(0 0 4px ${item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c'}80)` }}>
                                  {item.name.includes('TÜV') ? <ShieldCheck size={16} /> : item.name.includes('Gas') ? <Flame size={16} /> : item.name.includes('Dicht') ? <Droplet size={16} /> : <Settings size={16} />}
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>

        <DepartureChecklist state={state} setState={setState} />


    </div>
  );
}
