import { createUuid } from "../../lib/uuid.ts";
import React, { useState } from 'react';
import type { AppState, EmergencyGear, PharmacyItem } from '../../types';
import { ShieldPlus, Phone, Edit2, Trash2, MapPin, AlertTriangle, Plus, Check, Pill, Droplet, ShieldCheck, ChevronDown, User, HeartPulse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatNumber, formatWeight, normalizeGearName } from '../../lib/formatters';

interface SosHubProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  showSos: boolean;
  setShowSos: (v: boolean) => void;
  sosTab: 'hilfe' | 'id' | 'inhalt';
  setSosTab: (t: 'hilfe' | 'id' | 'inhalt') => void;
  gpsCoords: { lat: number; lng: number } | null;
  gpsAlt: number | null;
  gpsStatus: 'offline' | 'loading' | 'active';
}

export function SosHub({ state, setState, showSos, setShowSos, sosTab, setSosTab, gpsCoords, gpsAlt, gpsStatus }: SosHubProps) {
  const [editingPharmacyId, setEditingPharmacyId] = useState<string | null>(null);
  const [editingGearId, setEditingGearId] = useState<string | null>(null);
  const [deletingGearItem, setDeletingGearItem] = useState<any>(null);
  const [isEditingId, setIsEditingId] = useState(false);

  // Pharmacy expiry calculations (einheitlich mit StatusView: abgelaufen = nach Monatsende, "bald" = binnen 60 Tagen)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const expiredPharmacyItems = (state.sos.pharmacy || []).filter((p: PharmacyItem) => {
    if (!p.expiry) return false;
    const [year, month] = p.expiry.split('-').map(Number);
    const expiryDate = new Date(year, month, 0);
    return expiryDate < today;
  });

  const soonExpiringPharmacyItems = (state.sos.pharmacy || []).filter((p: PharmacyItem) => {
    if (!p.expiry) return false;
    const [year, month] = p.expiry.split('-').map(Number);
    const expiryDate = new Date(year, month, 0);
    if (expiryDate < today) return false;
    const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 60;
  });

  const updateSos = (field: string, val: string | boolean | number | EmergencyGear[] | PharmacyItem[] | null) => setState({...state, sos: {...state.sos, [field]: val}});

  return (
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
                                 <button
                                     onClick={() => updateSos('gpsEnabled', state.sos.gpsEnabled === false ? true : false)}
                                     className="flex items-center gap-1.5"
                                 >
                                     <div className={`w-[7px] h-[7px] rounded-full ${state.sos.gpsEnabled !== false ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.5)]' : 'bg-[var(--accent)] shadow-[0_0_6px_rgba(255,102,0,0.4)]'}`} />
                                     <span className={`text-[12px] font-bold tracking-[0.1em] uppercase ${state.sos.gpsEnabled !== false ? 'text-[#00ff9c]/80' : 'text-[var(--accent)]/80'}`}>GPS</span>
                                 </button>
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
                onChange={e => updateSos('ice1Name', e.target.value.replace(/[^a-zA-ZäöüÄÖÜßéèêàáâùúûìíîñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜŸ\s\-]/g, '').slice(0, 30))}
                maxLength={30}
                className="w-full bg-transparent border-none outline-none cg-master-value !p-0 !mb-2"
                placeholder="Name"
              />
              <div className="flex items-center gap-2 cg-master-muted">
                <Phone size={14} className="shrink-0 cg-master-muted" />
                <input
                  type="tel"
                  value={state.sos.ice1Phone}
                  onChange={e => updateSos('ice1Phone', e.target.value.replace(/[^\d+\s]/g, '').slice(0, 20))}
                  maxLength={20}
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
                onChange={e => updateSos('ice2Name', e.target.value.replace(/[^a-zA-ZäöüÄÖÜßéèêàáâùúûìíîñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜŸ\s\-]/g, '').slice(0, 30))}
                maxLength={30}
                className="w-full bg-transparent border-none outline-none cg-master-value !p-0 !mb-2"
                placeholder="Name"
              />
              <div className="flex items-center gap-2 cg-master-muted">
                <Phone size={14} className="shrink-0 cg-master-muted" />
                <input
                  type="tel"
                  value={state.sos.ice2Phone}
                  onChange={e => updateSos('ice2Phone', e.target.value.replace(/[^\d+\s]/g, '').slice(0, 20))}
                  maxLength={20}
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
      {(() => {
        const fullAddress = [
          [state.sos.street, state.sos.houseNumber].filter(Boolean).join(' '),
          [state.sos.zipCode, state.sos.city].filter(Boolean).join(' '),
          state.sos.country
        ].filter(Boolean).join(', ');
        return (
          <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
            {fullAddress.trim() ? (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noreferrer">
                    <MapPin size={16} className="text-[var(--accent)]" />
                </a>
            ) : (
                <MapPin size={16} className="text-[var(--accent)]" />
            )} Adresse
          </h4>
        );
      })()}

      <div className="cg-master-card-small">
        <div className="cg-master-inset p-3 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="cg-master-label">Vorname</div>
              <input
                type="text"
                value={state.sos.firstName || ''}
                onChange={e => updateSos('firstName', e.target.value.replace(/[^a-zA-ZäöüÄÖÜßéèêàáâùúûìíîñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜŸ\s\-]/g, '').slice(0, 30))}
                maxLength={30}
                className="w-full bg-transparent border-none outline-none cg-master-value"
                placeholder="Max"
              />
            </div>
            <div className="flex-1">
              <div className="cg-master-label">Nachname</div>
              <input
                type="text"
                value={state.sos.lastName || ''}
                onChange={e => updateSos('lastName', e.target.value.replace(/[^a-zA-ZäöüÄÖÜßéèêàáâùúûìíîñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜŸ\s\-]/g, '').slice(0, 30))}
                maxLength={30}
                className="w-full bg-transparent border-none outline-none cg-master-value"
                placeholder="Mustermann"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <div className="cg-master-label">Straße</div>
              <input
                type="text"
                value={state.sos.street || ''}
                onChange={e => updateSos('street', e.target.value.slice(0, 50))}
                maxLength={50}
                className="w-full bg-transparent border-none outline-none cg-master-value"
                placeholder="Musterstraße"
              />
            </div>
            <div className="w-24">
              <div className="cg-master-label">Nr.</div>
              <input
                type="text"
                value={state.sos.houseNumber || ''}
                onChange={e => updateSos('houseNumber', e.target.value.replace(/[^a-zA-Z0-9\/\-]/g, '').slice(0, 6))}
                maxLength={6}
                className="w-full bg-transparent border-none outline-none cg-master-value"
                placeholder="12"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="w-28">
              <div className="cg-master-label">PLZ</div>
              <input
                type="text"
                inputMode="numeric"
                value={state.sos.zipCode || ''}
                onChange={e => updateSos('zipCode', e.target.value.replace(/[^a-zA-Z0-9\s\-]/g, '').slice(0, 10))}
                maxLength={10}
                className="w-full bg-transparent border-none outline-none cg-master-value"
                placeholder="12345"
              />
            </div>
            <div className="flex-1">
              <div className="cg-master-label">Ort</div>
              <input
                type="text"
                value={state.sos.city || ''}
                onChange={e => updateSos('city', e.target.value.slice(0, 40))}
                maxLength={40}
                className="w-full bg-transparent border-none outline-none cg-master-value"
                placeholder="Musterstadt"
              />
            </div>
          </div>

          <div>
            <div className="cg-master-label">Land</div>
            <input
              type="text"
              value={state.sos.country || ''}
              onChange={e => updateSos('country', e.target.value.slice(0, 30))}
              maxLength={30}
              className="w-full bg-transparent border-none outline-none cg-master-value"
              placeholder="Deutschland"
            />
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

    <div className="cg-master-card-small !p-3 !mb-0 mt-4 border border-[var(--border)] bg-transparent">
        <p className="cg-type-meta cg-master-muted leading-relaxed text-center">
            Die hier hinterlegten Daten dienen als Gedächtnisstütze für den Notfall. Diese App ersetzt keine ärztliche Beratung, Diagnose oder Behandlung.
        </p>
    </div>

  </div>
)}

                 {sosTab === 'inhalt' && (
                     <div className="space-y-6 bg-[var(--bg-app)] rounded-2xl p-4 -mx-2 border border-[var(--border)] shadow-inner">
                         <div>
                             <h3 className="cg-master-section-title !mb-3 !mt-4 flex justify-between items-center">
                                 <span className="flex items-center"><ShieldPlus size={16} className="mr-2 text-[var(--accent)]"/>SOS-Ausrüstung</span>
                                 <button onClick={() => {
                                     const emptyItem = (state.sos.gear || []).find((g: EmergencyGear) => (!g.name || String(g.name).trim() === '') && (!g.count || g.count === 0) && (!g.weight || g.weight === '') && (!g.locations || g.locations.length === 0 || g.locations.every((l: string) => l.trim() === '')));
                                     if (emptyItem) {
                                         setEditingGearId(emptyItem.id);
                                         setTimeout(() => document.getElementById(`gear-${emptyItem.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                                     } else {
                                         const newId = createUuid();
                                         updateSos('gear', [...(state.sos.gear || []), { id: newId, name: '', checked: false, count: 0, locations: [''], weight: '', weightUnit: 'kg' }]);
                                         setEditingGearId(newId);
                                         setTimeout(() => document.getElementById(`gear-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                                     }
                                 }} className="cg-master-button !py-1.5 !px-3"><Plus size={14}/></button>
                             </h3>
                             {(state.sos.gear || []).map((g: EmergencyGear, i: number) => {
                                 const gearElementId = `gear-${g.id}`;
                                 const validLocations = (g.locations || []).filter((l: string) => l.trim() !== '');
                                 const hasWeight = g.weight !== undefined && g.weight !== null && g.weight !== '';
                                 const weightStr = hasWeight ? `${g.weight} ${g.weightUnit || 'kg'}` : '';
                                 
                                 const isEditing = editingGearId === g.id;
                                 
                                 return (
                                 <div id={gearElementId} key={g.id} className="cg-master-card-small mb-3">
                                     <div className="flex justify-between items-center select-none">
                                         <div className="flex items-start gap-3 flex-1 min-w-0 pr-3 cursor-pointer" onClick={() => {
                                             if (isEditing) setEditingGearId(null);
                                             else {
                                                 setEditingGearId(g.id);
                                                 if (!g.locations || g.locations.length === 0) {
                                                     updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, locations: [''] } : gx));
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
                                                         updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, locations: [''] } : gx));
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
                                                    <input value={g.name || ''} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, name: e.target.value } : gx))} placeholder="Ausrüstung" className={`cg-master-input w-full ${(!g.name || String(g.name).trim() === '') ? '!border-[var(--status-danger)]' : ''}`} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <span className="cg-master-label !mb-1 block">Menge</span>
                                                        <div className="flex h-[42px] items-center gap-1">
                                                            <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, count: Math.max(0, (gx.count||0)-1), checked: Math.max(0, (gx.count||0)-1) > 0 } : gx))} className="cg-master-inset cg-master-control w-[36px] h-full rounded flex items-center justify-center shrink-0">
                                                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                            </button>
                                                            <input type="number" min="0" value={g.count} onChange={e => { const val = parseInt(e.target.value) || 0; updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, count: val, checked: val > 0 } : gx)); }} className="cg-master-input flex-1 !h-full !text-center !px-1 !text-sm" />
                                                            <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, count: (gx.count||0)+1, checked: true } : gx))} className="cg-master-inset cg-master-control w-[36px] h-full rounded flex items-center justify-center shrink-0">
                                                                <Plus size={12}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="cg-master-label !mb-1 block">Gewicht/Stk.</span>
                                                        <div className="flex h-[42px] items-center gap-1">
                                                            <input type="number" step="0.01" min="0" value={g.weight !== undefined ? g.weight : ''} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, weight: e.target.value } : gx))} placeholder="0" className="cg-master-input flex-1 !h-full !text-center !px-1 !text-sm" />
                                                            <select value={g.weightUnit || 'kg'} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, weightUnit: e.target.value } : gx))} className="cg-master-input w-[50px] !h-full !px-1 !text-sm shrink-0">
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
                                                    <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, locations: [...(gx.locations || []), ''] } : gx))} className="cg-master-button !py-1.5 !px-3"><Plus size={14}/> Ort</button>
                                                </div>
                                                <div className="space-y-2">
                                                    {(g.locations || []).map((loc: string, locIdx: number) => (
                                                        <div key={locIdx} className="flex items-center gap-2">
                                                            <input value={loc} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, locations: (gx.locations || []).map((l: string, lIdx: number) => lIdx === locIdx ? e.target.value : l) } : gx))} placeholder={`Lagerort ${locIdx + 1}`} className="cg-master-input w-full !h-[42px]" />
                                                            <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: EmergencyGear, idx: number) => idx === i ? { ...gx, locations: (gx.locations || []).filter((_: string, lIdx: number) => lIdx !== locIdx) } : gx))} className="cg-master-inset cg-master-control-danger w-10 h-[42px] rounded flex items-center justify-center shrink-0"><Trash2 size={16} /></button>
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
                                                         updateSos('gear', (state.sos.gear || []).filter((gx: EmergencyGear) => gx.id !== g.id));
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
                                     const emptyItem = (state.sos.pharmacy || []).find((p: PharmacyItem) => (!p.name || String(p.name).trim() === '') && (!p.purpose || String(p.purpose).trim() === '') && (!p.expiry || String(p.expiry).trim() === '') && (!p.location || String(p.location).trim() === '') && (!p.weight || String(p.weight).trim() === '') && (!p.quantity || p.quantity === 1 || p.quantity === 0) && (!p.unit || p.unit === 'stk') && (!p.weightUnit || p.weightUnit === 'kg'));
                                     if (emptyItem) {
                                         setEditingPharmacyId(emptyItem.id);
                                         setTimeout(() => document.getElementById(`pharmacy-${emptyItem.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                                     } else {
                                         const newId = createUuid(); 
                                         updateSos('pharmacy', [...(state.sos.pharmacy || []), {id: newId, name:'', purpose:'', expiry:'', location:'', quantity:1, unit:'stk', weight: '', weightUnit: 'kg'}]); 
                                         setEditingPharmacyId(newId);
                                         setTimeout(() => document.getElementById(`pharmacy-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
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

                             {(state.sos.pharmacy || []).map((p: PharmacyItem, i: number) => {
                                  if (!p) return null;
                                  const pharmacyElementId = `pharmacy-${p.id}`;
                                  const isEditing = editingPharmacyId === String(p.id);
                                  const metaParts: string[] = [];
                                  if (p.purpose) metaParts.push(String(p.purpose));
                                  if (p.location) metaParts.push(String(p.location));
                                  if (p.expiry) metaParts.push(`Haltbar bis: ${p.expiry}`);
                                  return (
                                 <div id={pharmacyElementId} key={p.id} className="cg-master-card-small mb-3 relative">
                                     {isEditing ? (
                                        <>
                                     <div className="grid grid-cols-2 gap-3">
                                         <input value={p.name || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: PharmacyItem, idx: number) => idx === i ? { ...px, name: e.target.value } : px))} placeholder="Medikament" className={`cg-master-input w-full ${(!p.name || String(p.name).trim() === '') ? '!border-[var(--status-danger)]' : ''}`} />
                                         <input value={p.purpose || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: PharmacyItem, idx: number) => idx === i ? { ...px, purpose: e.target.value } : px))} placeholder="Zweck" className="cg-master-input w-full" />
                                         <div className="relative w-full">
                                             <div className={`cg-master-input w-full flex items-center ${!p.expiry ? 'text-[var(--text-muted)] !border-[var(--status-danger)]' : ''}`}>
                                                 {p.expiry ? p.expiry : 'Verfallsdatum'}
                                             </div>
                                             <input type="month" value={p.expiry || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: PharmacyItem, idx: number) => idx === i ? { ...px, expiry: e.target.value } : px))} className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer" />
                                         </div>
                                         <input value={p.location || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: PharmacyItem, idx: number) => idx === i ? { ...px, location: e.target.value } : px))} placeholder="Lagerort" className="cg-master-input w-full" />
                                         <input type="number" min="0" value={p.quantity} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: PharmacyItem, idx: number) => idx === i ? { ...px, quantity: parseInt(e.target.value) || 0 } : px))} placeholder="Menge" className="cg-master-input w-full" />
                                         <select value={p.unit} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: PharmacyItem, idx: number) => idx === i ? { ...px, unit: e.target.value } : px))} className="cg-master-select w-full">
                                             <option value="stk">Stk</option>
                                             <option value="ml">ml</option>
                                             <option value="l">l</option>
                                             <option value="g">g</option>
                                         </select>
                                         <input type="number" step="0.01" min="0" value={p.weight !== undefined ? p.weight : ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: PharmacyItem, idx: number) => idx === i ? { ...px, weight: e.target.value } : px))} placeholder="Gewicht/Stk." className="cg-master-input w-full" />
                                         <select value={p.weightUnit || 'kg'} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: PharmacyItem, idx: number) => idx === i ? { ...px, weightUnit: e.target.value } : px))} className="cg-master-select w-full">
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
                                                     updateSos('pharmacy', (state.sos.pharmacy || []).filter((px: PharmacyItem) => px.id !== p.id));
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
                                                <button onClick={() => { if(confirm('Medikament wirklich löschen?')) { updateSos('pharmacy', (state.sos.pharmacy || []).filter((_: PharmacyItem, idx: number) => idx !== i)); } }} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14}/></button>
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

          {deletingGearItem && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4">
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
                              const newGear = (state.sos.gear || []).filter((gx: EmergencyGear) => gx.id !== deletingGearItem.id);
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
  );
}
