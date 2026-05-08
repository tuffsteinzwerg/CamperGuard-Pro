import { useEffect, useState } from 'react';
import { ShieldPlus, Phone, Edit2, Trash2, MapPin, AlertTriangle, Plus, Check, Pill, Scale, CheckCircle, ChevronRight, Droplet, Fuel, Settings, ShieldCheck, Flame, ChevronDown, User, HeartPulse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatNumber, formatWeight, normalizeGearName } from '../lib/formatters';

export function StatusView({ state, setState, orientation }: any) {
  const [editingPharmacyId, setEditingPharmacyId] = useState<string | null>(null);
  const [editingGearId, setEditingGearId] = useState<string | null>(null);
  const [deletingGearItem, setDeletingGearItem] = useState<any>(null);
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
  
  const freshWaterLiters = (state.waterLevel / 100) * (state.profile.freshWaterCapacity || 0);
  const wasteWaterLiters = (state.wasteWaterLevel / 100) * (state.profile.wasteWaterCapacity || 0);
  const fuelLiters = (state.dieselLevel / 100) * (state.profile.dieselCapacity || 0);

  const waterWeightImpact = freshWaterLiters * 1;
  const wasteWaterWeight = wasteWaterLiters * 1;
  const dieselWeight = fuelLiters * 0.84;

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
  const warnings: { type: 'danger' | 'warn'; text: string; action?: 'pharmacy' }[] = [];
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

  // --- Medikamenten Ablauf Logik Start ---
  const expiredPharmacyItems: any[] = [];
  const soonExpiringPharmacyItems: any[] = [];
  (() => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      (state.sos?.pharmacy || []).forEach((p: any) => {
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
      {/* Element 1: SOS-Button */}
      {!showSos && (
      <div className="fixed top-[11px] left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none px-4 z-[60] pointer-events-none flex justify-end">
          <div className="pointer-events-auto mr-[46px]">
              <button onClick={() => setShowSos(true)} className="cg-master-button animate-pulse flex items-center gap-1.5">
                  <ShieldPlus size={16} strokeWidth={3} />
                  SOS
              </button>
          </div>
      </div>
      )}

      {/* Element 3: Gewichts-Hero-Anzeige */}
      <div className="cg-panel relative overflow-hidden p-6 z-0">
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

        <div className="text-[13px] text-[#8a939c] font-bold tracking-[0.3em] mb-8 text-center relative z-10 uppercase" style={{ textShadow: '0 -2px 2px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.08), 0 0 4px rgba(0,0,0,0.6)' }}>GESAMTGEWICHT</div>
        
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
                  
                  {/* Status Glow Bottom & Icon */}
                  {(() => {
                      const ratio = totalWeight / (state.profile.maxWeight || 3500);
                      const glowColor = ratio > 1 ? '#ff3b30' : ratio > 0.9 ? '#ffcc00' : '#00ff9c';
                      return (
                          <>
                              <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${glowColor} 0%, transparent 70%)` }} />
                              <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: glowColor, boxShadow: `0 -2px 8px ${glowColor}` }} />
                              <div className="absolute bottom-[22px] left-1/2 -translate-x-1/2 pointer-events-none" style={{ color: glowColor, filter: `drop-shadow(0 0 4px ${glowColor}80)` }}>
                                  <Scale size={18} />
                              </div>
                          </>
                      );
                  })()}
                  
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
              <div className="absolute z-20 w-[254px] h-[254px] pointer-events-none">
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
                      {!isCardinal && isOrdinal && <div className="mt-[4px] w-[2.5px] h-[8px] bg-[#ff6600] rounded-sm shadow-[0_0_6px_rgba(255,102,0,0.7)]" />}
                      {!isCardinal && !isOrdinal && isTen && <div className="mt-[5px] w-[2px] h-[6px] bg-[#888] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                      {!isCardinal && !isOrdinal && !isTen && <div className="mt-[6px] w-[1px] h-[4px] bg-[#555] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                    </div>
                  );
                })}
              </div>

              {/* Center Weight Display */}
              <div className="absolute z-30 flex flex-col items-center justify-center pointer-events-none">
                  <div className="relative flex items-baseline justify-center" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                      <span className={`instrument-value text-5xl tracking-normal ${
                          (totalWeight / (state.profile.maxWeight || 3500)) > 1 ? 'instrument-value-danger' :
                          (totalWeight / (state.profile.maxWeight || 3500)) > 0.9 ? 'instrument-value-warning' :
                          'instrument-value-success'
                      }`}>
                          {Math.round(totalWeight)}
                      </span>
                      <div className="w-0">
                          <span className="instrument-value text-base opacity-40 ml-2">kg</span>
                      </div>
                  </div>
                  
                  <div className="text-[10px] uppercase font-bold tracking-widest text-[#666] mt-1 relative z-10" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                      Max {formatNumber(state.profile.maxWeight || 3500, 0)} kg
                  </div>
              </div>
          </div>
          <div className="flex w-full pt-5 border-t border-white/5 relative cg-inset">
              {remainingWeight >= 0 ? (
                  <div className="flex items-center justify-center gap-2 w-full text-[#00ff9c]">
                      <CheckCircle size={20} className="filter drop-shadow-[0_0_8px_rgba(0,255,156,0.3)]" />
                      <div className="flex flex-col items-start leading-tight">
                         <span className="instrument-value-success text-[11px] font-bold tracking-widest uppercase">IM SICHEREN BEREICH</span>
                         <span className="cg-technical-label text-white/40 mt-0.5">noch {formatNumber(remainingWeight, 0)} kg frei</span>
                      </div>
                  </div>
              ) : (
                  <div className="flex items-center justify-center gap-2 w-full text-[var(--status-danger)] animate-pulse">
                      <AlertTriangle size={20} className="filter drop-[var(--status-danger)]" />
                      <div className="flex flex-col items-start leading-tight">
                         <span className="instrument-value-danger text-[11px] font-bold tracking-widest uppercase">ÜBERLADEN</span>
                         <span className="cg-technical-label text-[#ff3b30]/80 mt-0.5">{formatNumber(Math.abs(remainingWeight), 0)} kg zu viel</span>
                      </div>
                  </div>
              )}
          </div>
        </div>
      </div>

      {/* Element 5: Gewichtsaufschlüsselung */}
      <div className="cg-panel p-4">
          <div className="typo-engraved mb-4">GEWICHTSAUFSCHLÜSSELUNG</div>
          <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Leergewicht</span>
                  <span className="instrument-value text-sm">{formatNumber(state.profile.emptyWeight || 0, 0)} kg</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Frischwasser</span>
                  <span className="instrument-value text-sm text-blue-400">+ {formatWeight(waterWeightImpact)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Abwasser</span>
                  <span className="instrument-value text-sm text-gray-400">+ {formatWeight(wasteWaterWeight)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Diesel</span>
                  <span className="instrument-value text-sm text-orange-400">+ {formatWeight(dieselWeight)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Inventar</span>
                  <span className="instrument-value text-sm">+ {formatWeight(inventoryWeight)}</span>
              </div>
          </div>
          <hr className="divider my-4" />
          <div className="flex justify-between items-end">
              <span className="cg-technical-label">Gesamtgewicht</span>
              <div className="flex items-baseline gap-1">
                  <span className="instrument-value text-2xl">{formatNumber(totalWeight, 0)}</span>
                  <span className="instrument-value text-sm">kg</span>
              </div>
          </div>
      </div>

      {/* Element 2: Warnbereich */}
      {warnings.length > 0 && (
          <div className="flex flex-col gap-3">
              {warnings.map((w: any, idx: number) => (
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
              {(state.maintenance || []).map((item: any) => {
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

      {/* Element 7: Abfahrt-Checkliste */}
      <div className="cg-panel p-4">
          <div 
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setIsChecklistOpen(!isChecklistOpen)}
          >
              <div className="typo-engraved">ABFAHRT-CHECKLISTE</div>
              <span className={`transition-transform duration-200 text-[#8a939c] ${isChecklistOpen ? 'rotate-180' : ''}`}>
                  <ChevronDown size={16} />
              </span>
          </div>
          {isChecklistOpen && (
              <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                  {(state.checklist || []).map((item: any) => {
                      return (
                          <div key={item.id} className="cg-inset py-2 flex items-center justify-between group hover:bg-black/20 transition-colors px-3 rounded border border-white/5">
                              {editingChecklistItemId === item.id ? (
                                  <div className="flex items-center gap-2 flex-1 w-full">
                                      <input
                                          type="text"
                                          value={editingChecklistText}
                                          onChange={(e) => setEditingChecklistText(e.target.value)}
                                          className="cg-master-input flex-1 py-1 bg-black/50 border-white/10"
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
                                          className="cg-master-button !p-2 !rounded flex-shrink-0"
                                      >
                                          <Check size={16} />
                                      </button>
                                      <button onClick={() => setEditingChecklistItemId(null)} className="cg-master-button !p-2 !rounded flex-shrink-0">X</button>
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
                                          <button onClick={(e) => { e.stopPropagation(); setEditingChecklistText(item.label); setEditingChecklistItemId(item.id); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14}/></button>
                                          <button onClick={(e) => { e.stopPropagation(); setState({...state, checklist: state.checklist.filter((c:any) => c.id !== item.id)}); }} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14}/></button>
                                      </div>
                                  </>
                              )}
                          </div>
                      );
                  })}
                  <div className="cg-inset py-2 flex items-center gap-2 px-3 rounded border border-white/5">
                      <input 
                          type="text" 
                          placeholder="Neuer Eintrag..." 
                          value={newChecklistItem} 
                          onChange={(e) => setNewChecklistItem(e.target.value)} 
                          className="cg-master-input flex-1 bg-black/50 border-white/10"
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
                          className="cg-master-button !p-2 !rounded flex-shrink-0"
                      >
                          <Plus size={16} />
                      </button>
                  </div>
              </div>
          )}
      </div>

      <AnimatePresence>
          {showSos && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 cg-master-shell flex flex-col p-4 overflow-y-auto">
                 <div className="flex justify-between items-center mb-6 pt-4">
                     <h2 className="cg-master-section-title !mb-0 flex items-center gap-2"><ShieldPlus size={24}/> SAFETY HUB</h2>
                     <button onClick={() => setShowSos(false)} className="cg-master-button !px-4 !py-1">X</button>
                 </div>

                 <div className="sticky top-0 z-[100] cg-master-inset cg-master-tabs mb-8">
                    {['hilfe', 'id', 'inhalt'].map(t => (
                        <button key={t} onClick={() => setSosTab(t as any)} className={`cg-master-tab ${sosTab === t ? 'cg-master-tab-active' : ''}`}>
                            {t}
                        </button>
                    ))}
                 </div>

                 {sosTab === 'hilfe' && (
                     <div className="space-y-4 flex-1 relative z-0 bg-[var(--bg-app)] rounded-2xl p-4 -mx-2 border border-[var(--border)] shadow-inner">
                         <div className="cg-master-card-small relative group">
                             <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent)] relative z-10" />
                             <div className="flex justify-between items-center mb-3 relative z-10">
                                 <h3 
                                    className={`cg-master-label !mb-0 flex items-center gap-2 ${gpsStatus === 'active' && gpsCoords ? 'cursor-pointer active:opacity-70' : ''}`}
                                    onClick={() => {
                                        if (gpsStatus === 'active' && gpsCoords) {
                                            window.open(`https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`, '_blank');
                                        }
                                    }}
                                >
                                    <MapPin size={14} className="text-[var(--accent)]"/> DEINE POSITION
                                </h3>
                                 <div className="flex items-center gap-2">
                                     <span className="cg-master-label !mb-0">GPS</span>
                                     <button 
                                         onClick={() => updateSos('gpsEnabled', state.sos.gpsEnabled === false ? true : false)}
                                         className={`cg-master-inset w-7 h-7 rounded flex items-center justify-center border border-transparent transition-colors ${state.sos.gpsEnabled !== false ? 'cg-master-control-active' : ''}`}
                                     >
                                         {state.sos.gpsEnabled !== false && <Check size={16} />}
                                     </button>
                                 </div>
                             </div>
                             <div className={`cg-master-inset flex flex-col justify-center relative z-10 ${gpsStatus === 'active' ? 'min-h-[80px] p-3' : 'min-h-[60px] p-3 items-center'}`}>
                                 {gpsStatus === 'loading' && <span className="cg-master-value text-[var(--accent)] animate-pulse !text-[12px]">Signal wird ermittelt...</span>}
                                 {gpsStatus === 'offline' && <span className="cg-master-label !mb-0 cg-master-muted">GPS DEAKTIVIERT</span>}
                                 {gpsStatus === 'active' && gpsCoords && (
                                     <a 
                                         href={`https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`}
                                         target="_blank"
                                         rel="noopener noreferrer"
                                         className="flex gap-4 justify-around w-full no-underline"
                                         style={{ textDecoration: 'none' }}
                                     >
                                         <div className="flex flex-col text-center"><span className="cg-master-label !mb-0.5">Breite</span><span className="cg-master-value text-[var(--accent)]">{gpsCoords.lat.toFixed(6)}°</span></div>
                                         <div className="flex flex-col text-center"><span className="cg-master-label !mb-0.5">Länge</span><span className="cg-master-value text-[var(--accent)]">{gpsCoords.lng.toFixed(6)}°</span></div>
                                     </a>
                                 )}
                             </div>
                             {gpsStatus === 'active' && gpsAlt !== null && <div className="cg-master-label text-center text-[var(--accent)] mt-3 !mb-0 relative z-10">{Math.round(gpsAlt)} METER ÜBER NN</div>}
                         </div>

                         <div className="grid grid-cols-2 gap-4 mt-6">
                             <a href="tel:112" className="relative aspect-square w-full max-w-[120px] mx-auto rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90 block active:scale-95 transition-transform">
                                 <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                                 <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                                 <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#1a0a0a_0%,_#080303_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                                     <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                                     <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none bg-[radial-gradient(ellipse_at_bottom,_#ff3b30_0%,_transparent_70%)]" />
                                     <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none bg-[#ff3b30] shadow-[0_-2px_8px_#ff3b30]" />
                                 </div>
                                 <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-1">
                                     <div className="text-[10px] text-[#555] opacity-80 font-bold tracking-widest mb-0.5 uppercase">Notruf</div>
                                     <div className="flex items-baseline justify-center">
                                         <span className="text-3xl leading-none font-mono font-bold text-white tracking-tight drop-shadow-md">112</span>
                                     </div>
                                     <Phone size={14} className="text-[#ff3b30] mt-1.5 opacity-80 drop-shadow-[0_0_4px_rgba(255,59,48,0.6)]"/>
                                 </div>
                             </a>
                             <a href={`tel:${state.sos.ice1Phone}`} className="relative aspect-square w-full max-w-[120px] mx-auto rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90 block active:scale-95 transition-transform">
                                 <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                                 <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                                 <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#1a0f0a_0%,_#080503_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                                     <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                                     <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none bg-[radial-gradient(ellipse_at_bottom,_#ff9a3c_0%,_transparent_70%)]" />
                                     <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none bg-[#ff9a3c] shadow-[0_-2px_8px_#ff9a3c]" />
                                 </div>
                                 <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-1 px-4">
                                     <div className="text-[10px] text-[#555] opacity-80 font-bold tracking-widest mb-0.5 uppercase">ICE</div>
                                     <div className="flex items-baseline justify-center w-full overflow-hidden">
                                         <span className="text-sm leading-tight font-bold text-white tracking-tight drop-shadow-md truncate text-center w-full">
                                             {(state.sos.ice1Name || 'Kontakt').substring(0, 16)}
                                         </span>
                                     </div>
                                     <Phone size={14} className="text-[#ff9a3c] mt-1.5 opacity-80 drop-shadow-[0_0_4px_rgba(255,154,60,0.6)]"/>
                                 </div>
                             </a>
                         </div>

                         <div className="grid grid-cols-2 gap-3 mt-4">
                             <a href="https://www.google.com/maps/search/Apotheke" target="_blank" rel="noopener noreferrer" className="cg-master-button flex items-center justify-center gap-2 h-12 w-full typo-label"><MapPin size={14} className="text-[var(--accent)] shrink-0"/> Apotheke</a>
                             <a href="https://www.google.com/maps/search/Krankenhaus" target="_blank" rel="noopener noreferrer" className="cg-master-button flex items-center justify-center gap-2 h-12 w-full typo-label"><MapPin size={14} className="text-[var(--accent)] shrink-0"/> Krankenhaus</a>
                             <a href="https://www.google.com/maps/search/Arzt" target="_blank" rel="noopener noreferrer" className="cg-master-button flex items-center justify-center gap-2 h-12 w-full typo-label"><MapPin size={14} className="text-[var(--accent)] shrink-0"/> Arzt</a>
                             <a href="https://www.google.com/maps/search/Polizei" target="_blank" rel="noopener noreferrer" className="cg-master-button flex items-center justify-center gap-2 h-12 w-full typo-label"><ShieldCheck size={14} className="text-[var(--accent)] shrink-0"/> Polizei</a>
                         </div>
                     </div>
                 )}

                 {sosTab === 'id' && (
  <div className="space-y-4 relative z-10 bg-[var(--bg-app)] rounded-2xl p-4 -mx-2 border border-[var(--border)] shadow-inner">

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        <User size={16} className="text-[var(--accent)]" /> Notfall-Kontakte (ICE)
      </h4>

      <div className="cg-master-card-small !p-0">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-[var(--cg-master-border)]">
          <div className="flex-1 p-3">
            <div className="cg-master-label text-[var(--accent)] !mb-1">ICE 1</div>
            <div className="cg-master-inset p-3">
              <input
                value={state.sos.ice1Name}
                onChange={e => updateSos('ice1Name', e.target.value)}
                className="w-full bg-transparent border-none outline-none cg-master-value !p-0 !mb-2"
                placeholder="Name"
              />
              <div className="flex items-center gap-2 cg-master-muted">
                <Phone size={14} className="shrink-0 cg-master-muted" />
                <input
                  type="tel"
                  value={state.sos.ice1Phone}
                  onChange={e => updateSos('ice1Phone', e.target.value)}
                  className="w-full bg-transparent border-none outline-none cg-master-value !p-0"
                  placeholder="Telefonnummer"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 p-3">
            <div className="cg-master-label text-[var(--accent)] !mb-1">ICE 2</div>
            <div className="cg-master-inset p-3">
              <input
                value={state.sos.ice2Name}
                onChange={e => updateSos('ice2Name', e.target.value)}
                className="w-full bg-transparent border-none outline-none cg-master-value !p-0 !mb-2"
                placeholder="Name"
              />
              <div className="flex items-center gap-2 cg-master-muted">
                <Phone size={14} className="shrink-0 cg-master-muted" />
                <input
                  type="tel"
                  value={state.sos.ice2Phone}
                  onChange={e => updateSos('ice2Phone', e.target.value)}
                  className="w-full bg-transparent border-none outline-none cg-master-value !p-0"
                  placeholder="Telefonnummer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        <Droplet size={16} className="text-[var(--accent)]" /> Blutgruppe
      </h4>

      <div className="cg-master-card-small">
        <div className="cg-master-inset relative overflow-hidden">
          <select
            value={state.sos.bloodGroup || ""}
            onChange={e => updateSos('bloodGroup', e.target.value)}
            className="w-full bg-transparent border-none outline-none cg-master-value p-3 appearance-none cursor-pointer relative z-10"
            style={{ color: state.sos.bloodGroup ? 'var(--accent)' : undefined, fontWeight: state.sos.bloodGroup ? 900 : undefined, fontSize: state.sos.bloodGroup ? '18px' : undefined }}
          >
            <option value="" className="text-black bg-white">Unbekannt</option>
            <option value="A+" className="text-black bg-white">A+</option>
            <option value="A-" className="text-black bg-white">A-</option>
            <option value="B+" className="text-black bg-white">B+</option>
            <option value="B-" className="text-black bg-white">B-</option>
            <option value="AB+" className="text-black bg-white">AB+</option>
            <option value="AB-" className="text-black bg-white">AB-</option>
            <option value="0+" className="text-black bg-white">0+</option>
            <option value="0-" className="text-black bg-white">0-</option>
          </select>
          <ChevronDown size={16} className="cg-master-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 z-20" />
        </div>
      </div>
    </div>

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        <HeartPulse size={16} className="text-[var(--accent)]" /> Vorerkrankungen / Allergien
      </h4>

      <div className="cg-master-card-small">
        <div className="cg-master-inset p-3">
          <textarea
            value={state.sos.medicalConditions}
            onChange={e => updateSos('medicalConditions', e.target.value)}
            className="w-full bg-transparent border-none outline-none cg-master-value resize-none min-h-[90px]"
            placeholder="Bekannte Vorerkrankungen oder Allergien..."
          />
        </div>
      </div>
    </div>

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        <Pill size={16} className="text-[var(--accent)]" /> Medikamente
      </h4>

      <div className="cg-master-card-small">
        <div className="cg-master-inset p-3">
          <textarea
            value={state.sos.medications}
            onChange={e => updateSos('medications', e.target.value)}
            placeholder="Regelmäßige Medikationen hier eintragen..."
            className="w-full bg-transparent border-none outline-none cg-master-value resize-none min-h-[70px]"
          />
        </div>
      </div>
    </div>

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        {state.sos.address?.trim() ? (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(state.sos.address)}`} target="_blank" rel="noreferrer">
                <MapPin size={16} className="text-[var(--accent)]" />
            </a>
        ) : (
            <MapPin size={16} className="text-[var(--accent)]" />
        )} Adresse
      </h4>

      <div className="cg-master-card-small">
        <div className="cg-master-label">Anschrift</div>
        <textarea 
          value={state.sos.address || ''} 
          onChange={e => updateSos('address', e.target.value)} 
          className="cg-master-textarea w-full cg-master-value" 
          rows={5}
          placeholder={"Max Mustermann\nMusterstraße 12\n12345 Musterstadt\nDeutschland"} 
        />
      </div>
    </div>
  </div>
)}

                 {sosTab === 'inhalt' && (
                     <div className="space-y-6 bg-[var(--bg-app)] rounded-2xl p-4 -mx-2 border border-[var(--border)] shadow-inner">
                         <div>
                             <h3 className="cg-master-section-title !mb-3 !mt-4 flex justify-between items-center">
                                 <span className="flex items-center"><ShieldPlus size={16} className="mr-2 text-[var(--accent)]"/>SOS-Ausrüstung</span>
                                 <button onClick={() => {
                                     const emptyItem = (state.sos.gear || []).find((g: any) => (!g.name || String(g.name).trim() === '') && (!g.count || g.count === 0) && (!g.weight || g.weight === '') && (!g.locations || g.locations.length === 0 || g.locations.every((l: string) => l.trim() === '')));
                                     if (emptyItem) {
                                         setEditingGearId(emptyItem.id);
                                     } else {
                                         const newId = Date.now().toString();
                                         updateSos('gear', [...(state.sos.gear || []), { id: newId, name: '', checked: false, count: 0, locations: [''], weight: '', weightUnit: 'kg' }]);
                                         setEditingGearId(newId);
                                     }
                                 }} className="cg-master-button !py-1.5 !px-3"><Plus size={14}/></button>
                             </h3>
                             {(state.sos.gear || []).map((g: any, i: number) => {
                                 const validLocations = (g.locations || []).filter((l: string) => l.trim() !== '');
                                 const hasWeight = g.weight !== undefined && g.weight !== null && g.weight !== '';
                                 const weightStr = hasWeight ? `${g.weight} ${g.weightUnit || 'kg'}` : '';
                                 
                                 const isEditing = editingGearId === g.id;
                                 
                                 return (
                                 <div key={g.id} className="cg-master-card-small mb-3">
                                     <div className="flex justify-between items-center select-none">
                                         <div className="flex items-start gap-3 flex-1 min-w-0 pr-3 cursor-pointer" onClick={() => {
                                             if (isEditing) setEditingGearId(null);
                                             else {
                                                 setEditingGearId(g.id);
                                                 if (!g.locations || g.locations.length === 0) {
                                                     updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, locations: [''] } : gx));
                                                 }
                                             }
                                         }}>
                                             <h3 className="typo-section-title min-w-0 flex-1 line-clamp-2" style={{ color: 'var(--accent)', marginBottom: 0, minHeight: '32px' }}>{g.name}</h3>
                                             {Number(g.count) > 0 && (
                                                <span className="typo-value-small whitespace-nowrap mt-0.5">
                                                    {hasWeight ? weightStr : `${g.count} Stk`}
                                                </span>
                                             )}
                                         </div>
                                         <div className="flex flex-shrink-0 items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                         <button 
                                             onClick={() => { 
                                                 if (isEditing) {
                                                     setEditingGearId(null);
                                                 } else {
                                                     setEditingGearId(g.id);
                                                     if (!g.locations || g.locations.length === 0) {
                                                         updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, locations: [''] } : gx));
                                                     }
                                                 }
                                             }} 
                                             className={`cg-master-button !p-2 !rounded flex-shrink-0 ${isEditing ? '!bg-[var(--accent)] !text-black' : ''}`}
                                         >
                                             <Edit2 size={14} />
                                         </button>
                                         <button 
                                             onClick={() => setDeletingGearItem(g)}
                                             className="cg-master-button-danger !p-2 !rounded flex-shrink-0"
                                         >
                                             <Trash2 size={14} />
                                         </button>
                                         </div>
                                     </div>
                                     {isEditing && (
                                        <div className="mt-3 pt-3 border-t border-[var(--cg-master-border)]">
                                            <div className="mb-5">
                                                <div className="mb-3">
                                                    <input value={g.name || ''} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, name: e.target.value } : gx))} placeholder="Ausrüstung" className={`cg-master-input w-full ${(!g.name || String(g.name).trim() === '') ? '!border-[var(--status-danger)]' : ''}`} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <span className="cg-master-label !mb-1 block">Menge</span>
                                                        <div className="flex h-[42px] items-center gap-1">
                                                            <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, count: Math.max(0, (gx.count||0)-1), checked: Math.max(0, (gx.count||0)-1) > 0 } : gx))} className="cg-master-inset cg-master-control w-[36px] h-full rounded flex items-center justify-center shrink-0">
                                                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                            </button>
                                                            <input type="number" min="0" value={g.count} onChange={e => { const val = parseInt(e.target.value) || 0; updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, count: val, checked: val > 0 } : gx)); }} className="cg-master-input flex-1 !h-full !text-center !px-1 !text-sm" />
                                                            <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, count: (gx.count||0)+1, checked: true } : gx))} className="cg-master-inset cg-master-control w-[36px] h-full rounded flex items-center justify-center shrink-0">
                                                                <Plus size={12}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="cg-master-label !mb-1 block">Gewicht/Stk.</span>
                                                        <div className="flex h-[42px] items-center gap-1">
                                                            <input type="number" step="0.01" min="0" value={g.weight !== undefined ? g.weight : ''} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, weight: e.target.value } : gx))} placeholder="0" className="cg-master-input flex-1 !h-full !text-center !px-1 !text-sm" />
                                                            <select value={g.weightUnit || 'kg'} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, weightUnit: e.target.value } : gx))} className="cg-master-input w-[50px] !h-full !px-1 !text-sm shrink-0">
                                                                <option value="kg">kg</option>
                                                                <option value="g">g</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="cg-master-label !mb-0">Lagerorte</span>
                                                    <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, locations: [...(gx.locations || []), ''] } : gx))} className="cg-master-button !py-1.5 !px-3"><Plus size={14}/> Ort</button>
                                                </div>
                                                <div className="space-y-2">
                                                    {(g.locations || []).map((loc: string, locIdx: number) => (
                                                        <div key={locIdx} className="flex items-center gap-2">
                                                            <input value={loc} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, locations: (gx.locations || []).map((l: string, lIdx: number) => lIdx === locIdx ? e.target.value : l) } : gx))} placeholder={`Lagerort ${locIdx + 1}`} className="cg-master-input w-full !h-[42px]" />
                                                            <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, locations: (gx.locations || []).filter((_: any, lIdx: number) => lIdx !== locIdx) } : gx))} className="cg-master-inset cg-master-control-danger w-10 h-[42px] rounded flex items-center justify-center shrink-0"><Trash2 size={16} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                 {(()=>{
                                                     const isEmpty = (!g.name || String(g.name).trim() === '') && (!g.count || g.count === 0) && (!g.weight || g.weight === '') && (!g.locations || g.locations.length === 0 || g.locations.every((l: string) => l.trim() === ''));
                                                     return !isEmpty && (!g.name || String(g.name).trim() === '') ? (
                                                         <div className="text-[var(--status-danger)] text-xs text-center mb-2">Name der Ausrüstung ausfüllen.</div>
                                                     ) : null;
                                                 })()}
                                                 <button onClick={() => {
                                                     const isEmpty = (!g.name || String(g.name).trim() === '') && (!g.count || g.count === 0) && (!g.weight || g.weight === '') && (!g.locations || g.locations.length === 0 || g.locations.every((l: string) => l.trim() === ''));
                                                     if (isEmpty) {
                                                         updateSos('gear', (state.sos.gear || []).filter((gx: any) => gx.id !== g.id));
                                                         setEditingGearId(null);
                                                         return;
                                                     }
                                                     if (!g.name || String(g.name).trim() === '') return;
                                                     setEditingGearId(null);
                                                 }} className="cg-master-button w-full py-1 text-center rounded">Fertig</button>
                                            </div>
                                        </div>
                                     )}
                                 </div>
                                 );
                             })}
                         </div>
                         <div>
                             <h3 className="cg-master-section-title !mb-3 flex justify-between items-center">
                                 <span className="flex items-center"><Pill size={16} className="mr-2 text-[var(--accent)]"/>Apotheke</span>
                                 <button onClick={() => {
                                     const emptyItem = (state.sos.pharmacy || []).find((p: any) => (!p.name || String(p.name).trim() === '') && (!p.purpose || String(p.purpose).trim() === '') && (!p.expiry || String(p.expiry).trim() === '') && (!p.location || String(p.location).trim() === '') && (!p.weight || String(p.weight).trim() === '') && (!p.quantity || p.quantity === 1 || p.quantity === 0) && (!p.unit || p.unit === 'stk') && (!p.weightUnit || p.weightUnit === 'kg'));
                                     if (emptyItem) {
                                         setEditingPharmacyId(emptyItem.id);
                                     } else {
                                         const newId = Date.now().toString(); 
                                         updateSos('pharmacy', [...(state.sos.pharmacy || []), {id: newId, name:'', purpose:'', expiry:'', location:'', quantity:1, unit:'stk', weight: '', weightUnit: 'kg'}]); 
                                         setEditingPharmacyId(newId); 
                                     }
                                 }} className="cg-master-button !py-1.5 !px-3"><Plus size={14}/></button>
                             </h3>

                             {(expiredPharmacyItems.length > 0 || soonExpiringPharmacyItems.length > 0) && (
                                 <div className="mb-4 space-y-2">
                                     {expiredPharmacyItems.length > 0 && (
                                         <div className="cg-master-card-small !p-3 border-l-2 !border-l-[var(--status-danger)]">
                                             <div className="text-[var(--status-danger)] font-bold text-sm mb-1">{expiredPharmacyItems.length === 1 ? '1 Medikament abgelaufen' : `${expiredPharmacyItems.length} Medikamente abgelaufen`}</div>
                                             <div className="space-y-1">
                                                 {expiredPharmacyItems.slice(0, 3).map((item, idx) => (
                                                     <div key={idx} className="flex justify-between items-baseline text-xs">
                                                         <span className="truncate mr-2">{item.name || 'Unbenanntes Medikament'}</span>
                                                         {item.expiry && <span className="cg-master-muted whitespace-nowrap">Haltbar bis: {item.expiry}</span>}
                                                     </div>
                                                 ))}
                                                 {expiredPharmacyItems.length > 3 && (
                                                     <div className="text-xs cg-master-muted pt-1">+ {expiredPharmacyItems.length - 3} weitere</div>
                                                 )}
                                             </div>
                                         </div>
                                     )}
                                     {soonExpiringPharmacyItems.length > 0 && (
                                         <div className="cg-master-card-small !p-3 border-l-2 !border-l-[var(--status-warn)]">
                                             <div className="text-[var(--status-warn)] font-bold text-sm mb-1">{soonExpiringPharmacyItems.length === 1 ? '1 Medikament läuft bald ab' : `${soonExpiringPharmacyItems.length} Medikamente laufen bald ab`}</div>
                                             <div className="space-y-1">
                                                 {soonExpiringPharmacyItems.slice(0, 3).map((item, idx) => (
                                                     <div key={idx} className="flex justify-between items-baseline text-xs">
                                                         <span className="truncate mr-2">{item.name || 'Unbenanntes Medikament'}</span>
                                                         {item.expiry && <span className="cg-master-muted whitespace-nowrap">Haltbar bis: {item.expiry}</span>}
                                                     </div>
                                                 ))}
                                                 {soonExpiringPharmacyItems.length > 3 && (
                                                     <div className="text-xs cg-master-muted pt-1">+ {soonExpiringPharmacyItems.length - 3} weitere</div>
                                                 )}
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}

                             {(state.sos.pharmacy || []).map((p: any, i: number) => {
                                  if (!p) return null;
                                  const isEditing = editingPharmacyId === String(p.id);
                                  const metaParts: string[] = [];
                                  if (p.purpose) metaParts.push(String(p.purpose));
                                  if (p.location) metaParts.push(String(p.location));
                                  if (p.expiry) metaParts.push(`Haltbar bis: ${p.expiry}`);
                                  return (
                                 <div key={p.id} className="cg-master-card-small mb-3 relative">
                                     {isEditing ? (
                                        <>
                                     <div className="grid grid-cols-2 gap-3">
                                         <input value={p.name || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, name: e.target.value } : px))} placeholder="Medikament" className={`cg-master-input w-full ${(!p.name || String(p.name).trim() === '') ? '!border-[var(--status-danger)]' : ''}`} />
                                         <input value={p.purpose || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, purpose: e.target.value } : px))} placeholder="Zweck" className="cg-master-input w-full" />
                                         <div className="relative w-full">
                                             <div className={`cg-master-input w-full flex items-center ${!p.expiry ? 'text-[var(--text-muted)] !border-[var(--status-danger)]' : ''}`}>
                                                 {p.expiry ? p.expiry : 'Verfallsdatum'}
                                             </div>
                                             <input type="month" value={p.expiry || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, expiry: e.target.value } : px))} className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer" />
                                         </div>
                                         <input value={p.location || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, location: e.target.value } : px))} placeholder="Lagerort" className="cg-master-input w-full" />
                                         <input type="number" min="0" value={p.quantity} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, quantity: parseInt(e.target.value) || 0 } : px))} placeholder="Menge" className="cg-master-input w-full" />
                                         <select value={p.unit} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, unit: e.target.value } : px))} className="cg-master-select w-full">
                                             <option value="stk">Stk</option>
                                             <option value="ml">ml</option>
                                             <option value="l">l</option>
                                             <option value="g">g</option>
                                         </select>
                                         <input type="number" step="0.01" min="0" value={p.weight !== undefined ? p.weight : ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, weight: e.target.value } : px))} placeholder="Gewicht/Stk." className="cg-master-input w-full" />
                                         <select value={p.weightUnit || 'kg'} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, weightUnit: e.target.value } : px))} className="cg-master-select w-full">
                                             <option value="kg">kg</option>
                                             <option value="g">g</option>
                                         </select>
                                         <div className="col-span-2 mt-2">
                                             {(()=>{
                                                 const isEmpty = (!p.name || String(p.name).trim() === '') && (!p.purpose || String(p.purpose).trim() === '') && (!p.expiry || String(p.expiry).trim() === '') && (!p.location || String(p.location).trim() === '') && (!p.weight || String(p.weight).trim() === '') && (!p.quantity || p.quantity === 1 || p.quantity === 0) && (!p.unit || p.unit === 'stk') && (!p.weightUnit || p.weightUnit === 'kg');
                                                 return !isEmpty && ((!p.name || String(p.name).trim() === '') || !p.expiry) ? (
                                                     <div className="text-[var(--status-danger)] text-xs text-center mb-2">Medikament und Verfallsdatum ausfüllen.</div>
                                                 ) : null;
                                             })()}
                                             <button onClick={() => {
                                                 const isEmpty = (!p.name || String(p.name).trim() === '') && (!p.purpose || String(p.purpose).trim() === '') && (!p.expiry || String(p.expiry).trim() === '') && (!p.location || String(p.location).trim() === '') && (!p.weight || String(p.weight).trim() === '') && (!p.quantity || p.quantity === 1 || p.quantity === 0) && (!p.unit || p.unit === 'stk') && (!p.weightUnit || p.weightUnit === 'kg');
                                                 if (isEmpty) {
                                                     updateSos('pharmacy', (state.sos.pharmacy || []).filter((px: any) => px.id !== p.id));
                                                     setEditingPharmacyId(null);
                                                     return;
                                                 }
                                                 if ((!p.name || String(p.name).trim() === '') || !p.expiry) return;
                                                 setEditingPharmacyId(null);
                                             }} className="cg-master-button w-full py-1 text-center rounded">Fertig</button>
                                         </div>
                                     </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="typo-card-title truncate">{p.name || 'Neues Medikament'}</div>
                                            {metaParts.length > 0 && (
                                                <div className="typo-body-dim text-[var(--text-tertiary)] !mb-0 truncate">{metaParts.join(' • ')}</div>
                                            )}
                                        </div>
                                        <div className="flex flex-shrink-0 items-center justify-end">
                                            <div className="text-right whitespace-nowrap mr-3">
                                                {p.quantity !== undefined && p.quantity !== null && (
                                                    <div><span className="typo-value-normal">{p.quantity}</span><span className="typo-value-small ml-1">{p.unit}</span></div>
                                                )}
                                                {p.weight !== undefined && p.weight !== null && p.weight !== '' && (
                                                    <div className="typo-body-dim !mb-0">{p.weight} {p.weightUnit || 'kg'}</div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingPharmacyId(p.id)} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14}/></button>
                                                <button onClick={() => { if(confirm('Medikament wirklich löschen?')) { updateSos('pharmacy', (state.sos.pharmacy || []).filter((_: any, idx: number) => idx !== i)); } }} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    </div>
                                  )}
                                 </div>
                                  );
                              })}
                         </div>
                     </div>
                 )}
              </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingGearItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Ausrüstung löschen</h2>
                    <p className="typo-body">Willst du <strong>{deletingGearItem.name}</strong> wirklich löschen?</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingGearItem(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const deletedName = normalizeGearName(deletingGearItem.name);
                            const requiredCategories = ['Feuerlöscher', 'Feuerlöschdecke', 'Warnweste', 'Erste-Hilfe-Kasten', 'Warndreieck'];
                            const newDeletedGear = [...(state.sos.deletedGear || [])];
                            if (requiredCategories.includes(deletedName) && !newDeletedGear.includes(deletedName)) {
                                newDeletedGear.push(deletedName);
                            }
                            
                            const newGear = (state.sos.gear || []).filter((gx: any) => gx.id !== deletingGearItem.id);
                            
                            setState({
                                ...state,
                                sos: {
                                    ...state.sos,
                                    gear: newGear,
                                    deletedGear: newDeletedGear
                                }
                            });
                            setDeletingGearItem(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
