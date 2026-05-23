import React, { useState } from 'react';
import type { AppState, MaintenanceItem } from '../../types';
import { Search, Droplet, Fuel, Download, Upload, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatNumber } from '../lib/formatters';
import type { TireProfile } from '../types';

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

interface ProfilViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function ProfilView({ state, setState }: ProfilViewProps) {
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = () => {
    try {
      const exportPayload = {
        _meta: {
          app: 'CamperGuard Pro',
          version: '0.1.8-dev',
          exportDate: new Date().toISOString(),
          format: 1
        },
        data: state
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `camperguard-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setImportError('Nur JSON-Dateien werden unterstützt.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed._meta || !parsed.data) {
          setImportError('Ungültiges Backup-Format. Keine CamperGuard Pro Datei.');
          return;
        }
        if (parsed._meta.app !== 'CamperGuard Pro') {
          setImportError('Diese Datei stammt nicht von CamperGuard Pro.');
          return;
        }
        if (!parsed.data.profile || !parsed.data.sos) {
          setImportError('Backup-Datei ist beschädigt (fehlende Pflichtfelder).');
          return;
        }
        setImportData(parsed);
        setShowImportConfirm(true);
      } catch {
        setImportError('Datei konnte nicht gelesen werden. Ungültiges JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importData?.data) return;
    setState(importData.data);
    setShowImportConfirm(false);
    setImportData(null);
    setImportSuccess(true);
    setTimeout(() => setImportSuccess(false), 3000);
  };

  const [activeTireProfile, setActiveTireProfile] = useState<TireProfile>('Straße');
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
  const [focusedProfileField, setFocusedProfileField] = useState<string | null>(null);

  const hc = (path: string, val: any) => {
    setState((prev: AppState) => {
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
          <h1 className="cg-master-section-title mb-0">FAHRZEUG</h1>
          <button onClick={() => setShowFaqModal(true)} className="cg-master-button cg-master-label normal-case px-2 py-1 leading-none">FAQ</button>
      </div>
      
      <div className="cg-master-card-small space-y-4">
          <div><label className="cg-master-label">Camper Name</label><input value={state.profile.vehicleName} onChange={e => hc('profile.vehicleName', e.target.value)} placeholder="Spitzname..." className="cg-master-input w-full" /></div>
          <div>
            <label className="cg-master-label">Kennzeichen</label>
            <div className="flex gap-2 items-center">
                <input value={p1} maxLength={3} onChange={e => hc('profile.plate', [e.target.value.toUpperCase().trim(), p2, p3].join('-'))} placeholder="B" className="cg-master-input w-20 text-center uppercase" />
                <span className="cg-master-muted !mb-0">–</span>
                <input value={p2} maxLength={2} onChange={e => hc('profile.plate', [p1, e.target.value.toUpperCase().trim(), p3].join('-'))} placeholder="CG" className="cg-master-input w-16 text-center uppercase" />
                <span className="cg-master-muted !mb-0">–</span>
                <input value={p3} maxLength={4} onChange={e => hc('profile.plate', [p1, p2, e.target.value.toUpperCase().trim()].join('-'))} placeholder="1234" className="cg-master-input w-24 text-center uppercase font-mono" />
            </div>
          </div>
      </div>

      <div className="cg-master-card-small">
          <label className="cg-master-label">FAHRZEUGABMESSUNGEN IN CM</label>
          <div className="grid grid-cols-3 gap-3">
              {[ 
                  { l: 'HÖHE', k: 'height', min: 100, max: 500 }, 
                  { l: 'BREITE', k: 'width', min: 100, max: 300 }, 
                  { l: 'LÄNGE', k: 'length', min: 200, max: 1200 } 
              ].map(d => {
              const val = state.profile[d.k];
              const numVal = val !== '' && val !== undefined ? Number(val) : NaN;
              const isEmpty = val === '' || val === undefined;
              const isInvalid = !isEmpty && (isNaN(numVal) || numVal < d.min || numVal > d.max);

              return (
              <div key={d.k} className={`cg-master-card-small p-3 text-center ${isEmpty ? 'animate-pulse-border' : ''} ${isInvalid ? '!border-[var(--status-danger)]' : ''}`}>
                  <span className="typo-label mb-1 block">{d.l}</span>
                  <input 
                      type="text" 
                      inputMode="numeric"
                      value={!isEmpty && !isNaN(numVal) ? String(numVal) : ''} 
                      onChange={e => {
                          let rawVal = e.target.value.replace(/\D/g, '');
                          hc(`profile.${d.k}`, rawVal !== '' ? Number(rawVal) : '');
                      }} 
                      onKeyDown={e => {
                          if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === '.') e.preventDefault();
                      }}
                      className={`cg-master-input w-full text-center py-1 ${isEmpty ? 'text-[var(--text-muted)]' : 'text-white'} ${isInvalid ? 'text-[var(--status-danger)]' : ''}`} 
                      style={{ fontSize: '14px', fontWeight: 'normal', border: 'none', borderBottom: isInvalid ? '1px solid var(--status-danger)' : '1px solid var(--border)', borderRadius: 0, backgroundColor: 'transparent' }} 
                  />
                  {isInvalid && <span className="text-[var(--status-danger)] text-[10px] uppercase font-bold mt-1 block">Ungültiger Wert</span>}
              </div>
          )})}
      </div>
          <label className="cg-master-label mt-4">FAHRWERK (FÜR HÖHENKORREKTUR)</label>
          <div className="grid grid-cols-2 gap-3">
              {[
                  { l: 'SPURBREITE', k: 'trackWidth', min: 100, max: 250, hint: 'links ↔ rechts' },
                  { l: 'ACHSABSTAND', k: 'wheelbase', min: 150, max: 700, hint: 'vorne ↔ hinten' }
              ].map(d => {
                  const val = state.profile[d.k as keyof typeof state.profile];
                  const numVal = val !== '' && val !== undefined ? Number(val) : NaN;
                  const isEmpty = val === '' || val === undefined || val === 0;
                  const isInvalid = !isEmpty && (isNaN(numVal) || numVal < d.min || numVal > d.max);
                  return (
                      <div key={d.k} className={`cg-master-card-small p-3 text-center ${isEmpty ? 'animate-pulse-border' : ''} ${isInvalid ? '!border-[var(--status-danger)]' : ''}`}>
                          <span className="typo-label mb-0.5 block">{d.l}</span>
                          <span className="text-[9px] text-[#666] block mb-1">{d.hint}</span>
                          <input
                              type="text"
                              inputMode="numeric"
                              value={!isEmpty && !isNaN(numVal) ? String(numVal) : ''}
                              onChange={e => {
                                  let rawVal = e.target.value.replace(/\D/g, '');
                                  hc(`profile.${d.k}`, rawVal !== '' ? Number(rawVal) : '');
                              }}
                              onKeyDown={e => {
                                  if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === '.') e.preventDefault();
                              }}
                              className={`cg-master-input w-full text-center py-1 ${isEmpty ? 'text-[var(--text-muted)]' : 'text-white'} ${isInvalid ? 'text-[var(--status-danger)]' : ''}`}
                              style={{ fontSize: '14px', fontWeight: 'normal', border: 'none', borderBottom: isInvalid ? '1px solid var(--status-danger)' : '1px solid var(--border)', borderRadius: 0, backgroundColor: 'transparent' }}
                          />
                          {isInvalid && <span className="text-[var(--status-danger)] text-[10px] uppercase font-bold mt-1 block">Ungültiger Wert</span>}
                      </div>
                  );
              })}
          </div>
      </div>

      <div className="cg-master-card-small space-y-4">
          <div className="grid grid-cols-2 gap-3">
              <div className={`cg-master-card-small p-3 flex flex-col items-center justify-center ${!state.profile.emptyWeight ? 'animate-pulse-border' : ''}`}>
                  <span className="typo-label mb-1">Leergewicht</span>
                  <div className="flex items-baseline gap-1">
                    <input 
                       type="text" 
                       inputMode="numeric"
                       value={state.profile.emptyWeight ? Number(state.profile.emptyWeight).toLocaleString('de-DE') : ''} 
                       onChange={e => {
                           let rawVal = e.target.value.replace(/\D/g, '');
                           hc('profile.emptyWeight', rawVal !== '' ? Number(rawVal) : '');
                       }} 
                       onBlur={e => {
                           let val = state.profile.emptyWeight || 0;
                           if (val < 400) val = 400;
                           hc('profile.emptyWeight', val);
                       }}
                       className={`cg-master-input w-20 text-center ${!state.profile.emptyWeight ? 'text-[var(--text-muted)]' : 'text-white'}`} 
                       style={{ border: 'none', backgroundColor: 'transparent', padding: 0 }} 
                    />
                    <span className="typo-value-small">kg</span>
                  </div>
              </div>
              <div className={`cg-master-card-small p-3 flex flex-col items-center justify-center ${!state.profile.maxWeight ? 'animate-pulse-border' : ''}`}>
                  <span className="typo-label mb-1">ZGG</span>
                  <div className="flex items-baseline gap-1">
                    <input 
                       type="text" 
                       inputMode="numeric"
                       value={state.profile.maxWeight ? Number(state.profile.maxWeight).toLocaleString('de-DE') : ''} 
                       onChange={e => {
                           let rawVal = e.target.value.replace(/\D/g, '');
                           let num = rawVal !== '' ? Number(rawVal) : '';
                           if (typeof num === 'number' && num > 60000) num = 60000;
                           hc('profile.maxWeight', num);
                       }} 
                       className={`cg-master-input w-20 text-center ${!state.profile.maxWeight ? 'text-[var(--text-muted)]' : 'text-[var(--accent)]'}`} 
                       style={{ border: 'none', backgroundColor: 'transparent', padding: 0 }} 
                    />
                    <span className="typo-value-small">kg</span>
                  </div>
              </div>
          </div>

          <div className="cg-master-card-small p-4 flex flex-col gap-4 mt-2">
              {[ 
                  { l: 'Frischwasser', k: 'freshWaterCapacity' }, 
                  { l: 'Abwasser', k: 'wasteWaterCapacity' }, 
                  { l: 'Kraftstoff', k: 'dieselCapacity' } 
              ].map(d => (
                  <div key={d.k} className="flex justify-between items-center">
                      <span className="cg-master-label !mb-0 shrink-0">{d.l}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <input 
                            type="text" 
                            inputMode="numeric"
                            value={state.profile[d.k as keyof typeof state.profile] ? Number(state.profile[d.k as keyof typeof state.profile]).toLocaleString('de-DE') : ''} 
                            onChange={e => {
                                let rawVal = e.target.value.replace(/\D/g, '');
                                let num = rawVal !== '' ? Number(rawVal) : '';
                                if (typeof num === 'number' && num > 2000) num = 2000;
                                hc(`profile.${d.k}`, num);
                            }} 
                            className={`cg-master-input !w-24 !min-w-[6rem] !max-w-[6rem] text-center shrink-0 ${!state.profile[d.k as keyof typeof state.profile] ? 'animate-pulse-border text-[var(--text-muted)]' : 'text-white'}`} 
                        />
                        <span className="cg-master-muted shrink-0 w-4 text-left">L</span>
                      </div>
                  </div>
              ))}
          </div>

          <div className="cg-master-card-small space-y-4 pt-4 mt-3">
              <span className="typo-section-title mb-2 block">TANKSTÄNDE & FÜLLMENGEN</span>
              {[ 
                  { l: 'Frischwasser', k: 'freshWaterCapacity', levelKey: 'waterLevel', icon: <Droplet size={16} />, colorStart: '#2563eb', colorEnd: '#60a5fa', shadowColor: 'rgba(59, 130, 246, 0.4)' }, 
                  { l: 'Abwasser', k: 'wasteWaterCapacity', levelKey: 'wasteWaterLevel', icon: <Droplet size={16} />, colorStart: '#4b5563', colorEnd: '#9ca3af', shadowColor: 'rgba(107, 114, 128, 0.4)' }, 
                  { l: 'Kraftstoff', k: 'dieselCapacity', levelKey: 'dieselLevel', icon: <Fuel size={16} />, colorStart: '#ea580c', colorEnd: '#fb923c', shadowColor: 'rgba(234, 88, 12, 0.4)' } 
              ].map((d, index) => {
                  const capacity = state.profile[d.k as keyof typeof state.profile] || 0;
                  const level = state[d.levelKey as keyof typeof state] || 0;
                  const liters = (level / 100) * capacity;
                  
                  return (
                      <div key={d.k} className="cg-master-inset p-4 relative overflow-hidden flex flex-col gap-3">
                          <div className="flex justify-between items-center relative z-10">
                              <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 flex items-center justify-center rounded-full cg-master-inset" style={{ color: d.colorEnd }}>
                                      {d.icon}
                                  </div>
                                  <span className="cg-master-label !mb-0">{d.l}</span>
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                  <span className="cg-master-value !text-2xl leading-none">{level}<span className="text-sm opacity-50 ml-[1px]">%</span></span>
                                  <span className="cg-master-label text-white/40 mb-0.5">({formatNumber(liters, 0)} L)</span>
                              </div>
                          </div>
                      
                          <div className="relative h-6 flex items-center mt-1 z-10 group">
                              {/* Background Track */}
                              <div className="absolute w-full h-3 cg-master-inset rounded-full" />
                              
                              {/* Filled Track with Gradient & Glow */}
                              <div 
                                className="absolute h-3 rounded-full shadow-[0_0_10px_var(--shadow-color)] overflow-hidden"
                                style={{ 
                                  width: `${level}%`, 
                                  background: `linear-gradient(90deg, ${d.colorStart}, ${d.colorEnd})`,
                                  '--shadow-color': d.shadowColor,
                                  transition: 'width 0.1s ease-out'
                                } as React.CSSProperties}
                              >
                                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--text-secondary)] via-transparent to-transparent pointer-events-none" />
                              </div>
                              
                              {/* Range Input over top - fully transparent but functional */}
                              <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  step="1"
                                  value={level} 
                                  onChange={(e) => setState({...state, [d.levelKey]: parseInt(e.target.value)})}
                                  className="absolute w-full h-full opacity-0 cursor-pointer z-20 m-0 p-0"
                              />

                              {/* Custom Thumb - positioned based on percentage */}
                              <div 
                                className="absolute h-5 w-5 cg-master-inset rounded-full border-2 pointer-events-none z-10 top-1/2 -translate-y-1/2 -ml-2.5 transition-transform"
                                style={{ 
                                  left: `${level}%`,
                                  borderColor: d.colorStart,
                                  transition: 'left 0.1s ease-out, transform 0.2s'
                                }}
                              />
                          </div>
                      </div>
                  );
              })}
          </div>
          
          <div className="space-y-3 pt-2">
            <span className="typo-section-title mb-2 block">Wartungs-Termine</span>
            {state.maintenance.map((m: MaintenanceItem, idx: number) => (
                <div key={m.id} className="flex items-center gap-3">
                    <span className="typo-label w-24">{m.name}</span>
                    <input type="date" value={m.date} onChange={(e) => { const nm = [...state.maintenance]; nm[idx].date = e.target.value; setState({...state, maintenance: nm}); }} className={`cg-master-input flex-1 ${!m.date ? 'animate-pulse-border text-[var(--text-muted)]' : ''}`} />
                </div>
            ))}
          </div>
      </div>

      <div className="cg-master-card-small space-y-4 border-l-4" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="flex justify-between items-center">
             <span className="typo-section-title" style={{ color: 'white' }}>Reifendruck (bar)</span>
             <button onClick={() => hc('profile.isTwinTires', !state.profile.isTwinTires)} className="typo-label transition-colors" style={{ color: state.profile.isTwinTires ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)' }}>+ ZWILLING</button>
          </div>
          
          <select value={activeTireProfile} onChange={e => setActiveTireProfile(e.target.value as any)} className="cg-master-input w-full">
              {TIRE_PROFILES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
             {/* FRONT LEFT */}
             {(() => {
                 const isInv = (v: any) => v !== undefined && v !== '' && v !== null && !isNaN(Number(v)) && (Number(v) <= 0 || Number(v) > 10);
                 const iFL = isInv(tp.frontLeft);
                 const iFR = isInv(tp.frontRight);
                 const iRL = isInv(tp.rearLeft);
                 const iRLO = isInv(tp.rearLeftOuter ?? tp.rearLeft);
                 const iRR = isInv(tp.rearRight);
                 const iRRO = isInv(tp.rearRightOuter ?? tp.rearRight);

                 return (
                     <>
                         <div className="cg-master-inset p-3 flex flex-col items-center justify-center text-center">
                             <span className="cg-master-label text-center mb-1">VL {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                             <input type="number" step="0.1" value={tp.frontLeft ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.frontLeft`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!tp.frontLeft ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iFL ? '!text-[var(--status-danger)]' : ''}`} />
                             {iFL && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                         </div>
                         {/* FRONT RIGHT */}
                         <div className="cg-master-inset p-3 flex flex-col items-center justify-center text-center">
                             <span className="cg-master-label text-center mb-1">VR {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                             <input type="number" step="0.1" value={tp.frontRight ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.frontRight`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!tp.frontRight ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iFR ? '!text-[var(--status-danger)]' : ''}`} />
                             {iFR && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                         </div>
                         {/* REAR LEFT */}
                         <div className="cg-master-inset p-3 flex flex-col items-center justify-center text-center">
                             <span className="cg-master-label text-center mb-1">HL {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                             <input type="number" step="0.1" value={tp.rearLeft ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.rearLeft`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!tp.rearLeft ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iRL ? '!text-[var(--status-danger)]' : ''}`} />
                             {iRL && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                             
                             {state.profile.isTwinTires && (
                                <>
                                    <span className="cg-master-label text-center mb-1 mt-3">HL (Außen)</span>
                                    <input type="number" step="0.1" value={tp.rearLeftOuter ?? tp.rearLeft ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.rearLeftOuter`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!(tp.rearLeftOuter ?? tp.rearLeft) ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iRLO ? '!text-[var(--status-danger)]' : ''}`} />
                                    {iRLO && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                                </>
                             )}
                         </div>
                         {/* REAR RIGHT */}
                         <div className="cg-master-inset p-3 flex flex-col items-center justify-center text-center">
                             <span className="cg-master-label text-center mb-1">HR {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                             <input type="number" step="0.1" value={tp.rearRight ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.rearRight`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!tp.rearRight ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iRR ? '!text-[var(--status-danger)]' : ''}`} />
                             {iRR && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                             
                             {state.profile.isTwinTires && (
                                <>
                                    <span className="cg-master-label text-center mb-1 mt-3">HR (Außen)</span>
                                    <input type="number" step="0.1" value={tp.rearRightOuter ?? tp.rearRight ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.rearRightOuter`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!(tp.rearRightOuter ?? tp.rearRight) ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iRRO ? '!text-[var(--status-danger)]' : ''}`} />
                                    {iRRO && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                                </>
                             )}
                         </div>
                     </>
                 );
             })()}
          </div>
      </div>

      {/* --- BACKUP / EXPORT --- */}
      <div className="cg-master-card p-4 mt-6">
          <h2 className="typo-section-title mb-4">Datensicherung</h2>
          <div className="space-y-3">
              <button onClick={handleExport} className="cg-master-button w-full flex items-center justify-center gap-2 py-3">
                  <Download size={16} />
                  <span className="typo-label">Daten exportieren</span>
              </button>
              {exportSuccess && <div className="text-center typo-body text-[var(--status-success)] py-1">✓ Export erfolgreich</div>}

              <label className="cg-master-button w-full flex items-center justify-center gap-2 py-3 cursor-pointer">
                  <Upload size={16} />
                  <span className="typo-label">Daten importieren</span>
                  <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
              </label>
              {importError && <div className="text-center typo-body text-[var(--status-danger)] py-1">{importError}</div>}
              {importSuccess && <div className="text-center typo-body text-[var(--status-success)] py-1">✓ Import erfolgreich — Daten wiederhergestellt</div>}
          </div>
      </div>

      {/* --- IMPORT BESTÄTIGUNG --- */}
      <AnimatePresence>
          {showImportConfirm && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6">
                 <div className="cg-master-card p-6 max-w-sm w-full space-y-4">
                     <div className="flex items-center gap-3">
                         <AlertTriangle size={24} className="text-[var(--status-danger)] flex-shrink-0" />
                         <h2 className="typo-section-title">Daten überschreiben?</h2>
                     </div>
                     <p className="typo-body-dim">Alle aktuellen Daten werden durch das Backup ersetzt. Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
                     {importData?._meta && (
                         <div className="cg-master-inset p-3 space-y-1">
                             <div className="typo-label text-[var(--text-muted)]">Backup vom</div>
                             <div className="typo-value-normal">{new Date(importData._meta.exportDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                             <div className="typo-label text-[var(--text-muted)] mt-2">App-Version</div>
                             <div className="typo-value-normal">{importData._meta.version}</div>
                         </div>
                     )}
                     <div className="flex gap-3">
                         <button onClick={() => { setShowImportConfirm(false); setImportData(null); }} className="cg-master-button flex-1 py-3">Abbrechen</button>
                         <button onClick={confirmImport} className="cg-master-button-danger flex-1 py-3">Überschreiben</button>
                     </div>
                 </div>
             </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {showFaqModal && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4">
                 <div className="flex justify-between items-center mb-6 pt-4"><h2 className="typo-section-title">FAQ</h2><button onClick={()=>setShowFaqModal(false)} className="cg-master-button px-3 py-1">X</button></div>
                 <div className="relative mb-4">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={14} />
                     <input type="text" placeholder="FAQ DURCHSUCHEN..." className="cg-master-input w-full pl-10 pr-4" value={faqSearch} onChange={(e) => setFaqSearch(e.target.value)} />
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                     {faqData.filter(f => f.q.toLowerCase().includes(faqSearch.toLowerCase()) || f.a.toLowerCase().includes(faqSearch.toLowerCase())).map((f: FAQEntry, i: number) => (
                         <div key={i} className="cg-master-card-small space-y-3 relative">
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
