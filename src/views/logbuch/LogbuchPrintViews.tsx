import React from 'react';
import { formatNumber } from '../../lib/formatters';
import { PrintHeader } from '../../print/PrintHeader';
import type { AppState, FuelEntry, TripEntry, BusinessTripEntry, SpotEntry, Archive } from '../../types';

interface LogbuchPrintViewsProps {
  logType: 'tank' | 'fahrt' | 'spots' | 'archiv';
  tripLogMode: 'flex' | 'strict';
  selectedArchive: Archive | null;
  archiveViewTab: 'tank' | 'trip' | 'business' | 'spots';
  printFuelLog: FuelEntry[];
  printTripLog: TripEntry[];
  printBusinessTripLog: BusinessTripEntry[];
  printSpots: SpotEntry[];
  printTitle: string;
  printDateRange: string;
  currentFuelLog: FuelEntry[];
  currentTripLog: TripEntry[];
  currentBusinessTripLog: BusinessTripEntry[];
  totalLiters: number;
  totalEur: number;
  totalKm: number;
  result: { consumption: number | null } | null;
  currentYear: number;
  state: AppState;
}

export function LogbuchPrintViews(props: LogbuchPrintViewsProps) {
  const {
    logType, tripLogMode, selectedArchive, archiveViewTab,
    printFuelLog, printTripLog, printBusinessTripLog, printSpots,
    printTitle, printDateRange,
    currentFuelLog, currentTripLog, currentBusinessTripLog,
    totalLiters, totalEur, totalKm, result, currentYear, state
  } = props;

  return (
      <div className="hidden print-only logbuch-print-wrapper bg-white">
          <PrintHeader 
              title={printTitle}
              vehicleName={state.profile?.vehicleName} 
              plate={state.profile?.plate}
              dateRange={printDateRange}
              createdDate={new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          />

          {((!selectedArchive && logType === 'tank') || (selectedArchive && archiveViewTab === 'tank')) && (
             printFuelLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             (() => {
                 const sortedDates = [...printFuelLog].sort((a:any,b:any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                 const dateRangeStr = sortedDates.length > 0 ? `${new Date(sortedDates[0].date).toLocaleDateString('de-DE')} - ${new Date(sortedDates[sortedDates.length - 1].date).toLocaleDateString('de-DE')}` : `Jahr ${currentYear}`;

                 return (
                     <div className="tank-print-layout">
                         <style>{`
                             @media print {
                                 .tank-print-meta-grid {
                                     display: grid;
                                     grid-template-columns: 1.3fr 0.8fr 1fr 1fr 1fr;
                                     gap: 5mm;
                                     margin: 2mm 0 2mm 0;
                                     padding-bottom: 2mm;
                                     border-bottom: 0.4pt solid #cfcfcf;
                                 }
                                 .tank-print-column-grid {
                                     display: grid;
                                     grid-template-columns: 13% 19% 18% 14% 16% 20%;
                                 }
                                 .tank-print-row {
                                     display: grid;
                                     grid-template-columns: 13% 19% 18% 14% 16% 20%;
                                 }
                                 .tank-print-bottom-summary {
                                     display: grid;
                                     grid-template-columns: repeat(4, 1fr);
                                 }
                             }
                         `}</style>

                         <div className="tank-print-meta-grid">
                             <div>
                                 <div className="tank-print-meta-label cg-print-meta-label">Zeitraum</div>
                                 <div className="tank-print-meta-value cg-print-meta-value">{dateRangeStr}</div>
                             </div>
                             <div>
                                 <div className="tank-print-meta-label cg-print-meta-label">Tankungen</div>
                                 <div className="tank-print-meta-value cg-print-meta-value">{currentFuelLog.length}</div>
                             </div>
                             <div>
                                 <div className="tank-print-meta-label cg-print-meta-label">Gesamtliter</div>
                                 <div className="tank-print-meta-value cg-print-meta-value">{formatNumber(totalLiters, 1)} L</div>
                             </div>
                             <div>
                                 <div className="tank-print-meta-label cg-print-meta-label">Gesamtkosten</div>
                                 <div className="tank-print-meta-value cg-print-meta-value">{formatNumber(totalEur, 2)} €</div>
                             </div>
                             <div>
                                 <div className="tank-print-meta-label cg-print-meta-label">Durchschnitt</div>
                                 <div className="tank-print-meta-value cg-print-meta-value">{result?.consumption != null ? `${formatNumber(result.consumption, 1)} L/100km` : '—'}</div>
                             </div>
                         </div>
                         
                         <div className="tank-print-column-grid cg-print-col-header">
                             <div style={{textAlign: 'left'}}><span style={{marginRight: '4px', fontSize: '9pt'}}>📅</span> Datum</div>
                             <div style={{textAlign: 'left'}}><span style={{marginRight: '4px', fontSize: '9pt'}}>🔧</span> Kilometerstand<br/><span style={{fontWeight: 400, fontSize: '6pt', marginLeft: '16px'}}>(seit letzter Tankung)</span></div>
                             <div style={{textAlign: 'left'}}><span style={{marginRight: '4px', fontSize: '9pt'}}>⛽</span> Kraftstoff</div>
                             <div style={{textAlign: 'right'}}><span style={{marginRight: '4px', fontSize: '9pt'}}>💧</span> Liter</div>
                             <div style={{textAlign: 'right'}}><span style={{marginRight: '4px', fontSize: '9pt'}}>🏷️</span> Preis / L</div>
                             <div style={{textAlign: 'right'}}><span style={{marginRight: '4px', fontSize: '9pt'}}>🧾</span> Gesamtpreis</div>
                         </div>

                         <div className="tank-print-row-list">
                             {printFuelLog.map((f:any, idx:number) => {
                                 const totalBetrag = (f.liters * f.price) / (f.exchangeRateToEur || 1);
                                 const sortedByKm = [...printFuelLog].filter((e:any) => e.km != null && !isNaN(e.km)).sort((a:any, b:any) => a.km - b.km);
                                 const isFirstTankung = sortedByKm.length > 0 && f.id === sortedByKm[0].id;
                                 const prevEntry = sortedByKm.find((e:any, i:number) => i < sortedByKm.length - 1 && sortedByKm[i + 1].id === f.id);
                                 const kmDelta = (prevEntry && f.km != null && !isNaN(f.km)) ? f.km - prevEntry.km : null;
                                 const hasKm = f.km != null && !isNaN(f.km);
                                 let kmDeltaStr = '(—)';
                                 if (isFirstTankung) kmDeltaStr = '(Erste Tankung)';
                                 else if (kmDelta != null && kmDelta > 0) kmDeltaStr = `(${formatNumber(kmDelta, 0)} km)`;

                                 return (
                                     <div key={f.id} className="tank-print-row cg-print-row">
                                         <div className="cg-print-cell-date">{new Date(f.date).toLocaleDateString('de-DE')}</div>
                                         <div className="cg-print-cell-name">
                                             {hasKm ? <><strong>{formatNumber(f.km, 0)} km</strong> <span className="cg-print-km-delta">{kmDeltaStr}</span></> : <span style={{color: '#888'}}>-</span>}
                                         </div>
                                         <div className="cg-print-cell-muted">{f.fuelType}</div>
                                         <div className="cg-print-cell-num">{formatNumber(f.liters, 2)} l</div>
                                         <div className="cg-print-cell-num">{formatNumber(f.price, 3)} €</div>
                                         <div className="cg-print-cell-orange">{formatNumber(totalBetrag, 2)} €</div>
                                     </div>
                                 );
                             })}
                         </div>

                         <div className="tank-print-bottom-wrapper cg-print-summary-wrapper">
                             <div className="cg-print-summary-title">Übersicht Zeitraum</div>
                             <div className="tank-print-bottom-summary cg-print-summary-grid">
                                 <div>
                                     <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '9pt'}}>🚐</span> Gefahrene Kilometer</div>
                                     <div className="cg-print-summary-value">{formatNumber(totalKm, 0)} km</div>
                                 </div>
                                 <div>
                                     <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '9pt'}}>💧</span> Getankte Liter</div>
                                     <div className="cg-print-summary-value">{formatNumber(totalLiters, 1)} l</div>
                                 </div>
                                 <div>
                                     <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '9pt'}}>💶</span> Gesamtkosten</div>
                                     <div className="cg-print-summary-value">{formatNumber(totalEur, 2)} €</div>
                                 </div>
                                 <div>
                                     <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '9pt'}}>⛽</span> Durchschnitt</div>
                                     <div className="cg-print-summary-value">{result?.consumption != null ? `${formatNumber(result.consumption, 2)} l / 100 km` : '—'}</div>
                                     {totalLiters > 0 && totalEur > 0 && <div className="cg-print-summary-value">{formatNumber(totalEur / totalLiters, 2)} € / l</div>}
                                 </div>
                             </div>
                         </div>
                     </div>
                 );
             })()
          )}

          {((!selectedArchive && logType === 'fahrt' && tripLogMode === 'flex') || (selectedArchive && archiveViewTab === 'trip')) && (
             printTripLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <div>
                 <div className="reise-print-column-grid cg-print-col-header">
                     <div style={{textAlign: 'left'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>📅</span> Datum</div>
                     <div style={{textAlign: 'left'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>📍</span> Zielort</div>
                     <div style={{textAlign: 'right'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>🏁</span> Start km</div>
                     <div style={{textAlign: 'right'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>🏁</span> Ziel km</div>
                     <div style={{textAlign: 'right'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>📏</span> Strecke</div>
                     <div style={{textAlign: 'left', paddingLeft: '2mm'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>📝</span> Notiz</div>
                 </div>
                 <div>
                     {printTripLog.map((t:any) => {
                         const strecke = (t.toKm != null && t.fromKm != null && !isNaN(t.toKm - t.fromKm)) ? t.toKm - t.fromKm : null;
                         return (
                             <div key={t.id} className="reise-print-row cg-print-row">
                                 <div className="cg-print-cell-date">{new Date(t.date).toLocaleDateString('de-DE')}</div>
                                 <div className="cg-print-cell-name">{t.destination}</div>
                                 <div className="cg-print-cell-num">{(t.fromKm != null && !isNaN(t.fromKm)) ? Number(t.fromKm).toLocaleString('de-DE') : '-'}</div>
                                 <div className="cg-print-cell-num">{(t.toKm != null && !isNaN(t.toKm)) ? Number(t.toKm).toLocaleString('de-DE') : '-'}</div>
                                 <div className="cg-print-cell-bold">{strecke != null ? `${Number(strecke).toLocaleString('de-DE')} km` : '-'}</div>
                                 <div className="cg-print-cell-note">{t.purpose || t.note || ''}</div>
                             </div>
                         );
                     })}
                 </div>
                 <div className="cg-print-summary-wrapper">
                     <div className="cg-print-summary-title">Übersicht Zeitraum</div>
                     <div className="reise-print-summary-grid cg-print-summary-grid">
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>🗺️</span> Fahrten</div>
                             <div className="cg-print-summary-value">{currentTripLog.length}</div>
                         </div>
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>🚐</span> Gesamtstrecke</div>
                             <div className="cg-print-summary-value">{Number(totalKm).toLocaleString('de-DE')} km</div>
                         </div>
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>📏</span> Ø pro Fahrt</div>
                             <div className="cg-print-summary-value">{currentTripLog.length > 0 ? Number(Math.round(totalKm / currentTripLog.length)).toLocaleString('de-DE') : '0'} km</div>
                         </div>
                     </div>
                 </div>
             </div>
          )}

          {((!selectedArchive && logType === 'fahrt' && tripLogMode === 'strict') || (selectedArchive && archiveViewTab === 'business')) && (
             printBusinessTripLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <div>
                 <div className="fb-print-hdr1 cg-print-col-header">
                     <div style={{textAlign: 'left'}}><span style={{marginRight: '2px', fontSize: '7pt'}}>📅</span> Datum</div>
                     <div style={{textAlign: 'center'}}><span style={{marginRight: '2px', fontSize: '7pt'}}>🕐</span> Ab</div>
                     <div style={{textAlign: 'center'}}><span style={{marginRight: '2px', fontSize: '7pt'}}>🕐</span> An</div>
                     <div style={{textAlign: 'left'}}><span style={{marginRight: '2px', fontSize: '7pt'}}>👤</span> Fahrer</div>
                     <div style={{textAlign: 'left'}}><span style={{marginRight: '2px', fontSize: '7pt'}}>🏷️</span> Kategorie</div>
                     <div style={{textAlign: 'right'}}><span style={{marginRight: '2px', fontSize: '7pt'}}>🏁</span> Start km</div>
                     <div style={{textAlign: 'right'}}><span style={{marginRight: '2px', fontSize: '7pt'}}>🏁</span> Ziel km</div>
                     <div style={{textAlign: 'right'}}><span style={{marginRight: '2px', fontSize: '7pt'}}>📏</span> Strecke</div>
                 </div>
                 <div className="fb-print-hdr2 cg-print-col-header-sub">
                     <div style={{textAlign: 'left', paddingLeft: '1mm'}}>📍 Reiseziel (Straße Nr, PLZ Ort)</div>
                     <div style={{textAlign: 'left'}}>📝 Reisezweck</div>
                     <div style={{textAlign: 'left'}}>🤝 Geschäftspartner</div>
                     <div style={{textAlign: 'left'}}>📌 Notiz / Route</div>
                 </div>
                 <div>
                     {printBusinessTripLog.map((t:any) => {
                         const strecke = (t.toKm != null && t.fromKm != null && !isNaN(t.toKm - t.fromKm)) ? t.toKm - t.fromKm : null;
                         const addrParts = [t.street, t.houseNumber].filter(Boolean).join(' ');
                         const plzOrt = [t.zip, t.city].filter(Boolean).join(' ');
                         const fullAddr = [addrParts, plzOrt].filter(Boolean).join(', ');
                         const catClass = t.category === 'Dienstlich' ? 'cg-print-cat-dienstlich' : t.category === 'Privat' ? 'cg-print-cat-privat' : 'cg-print-cat-arbeitsweg';
                         return (
                             <div key={t.id}>
                                 <div className="fb-row1 cg-print-row">
                                     <div className="cg-print-cell-date">{new Date(t.date).toLocaleDateString('de-DE')}</div>
                                     <div className="cg-print-cell-time">{t.departureTime || '—'}</div>
                                     <div className="cg-print-cell-time">{t.arrivalTime || '—'}</div>
                                     <div className="cg-print-cell-muted">{t.driver}</div>
                                     <div className={`fb-cat ${catClass}`}>{t.category}</div>
                                     <div className="cg-print-cell-num">{(t.fromKm != null && !isNaN(t.fromKm)) ? Number(t.fromKm).toLocaleString('de-DE') : '-'}</div>
                                     <div className="cg-print-cell-num">{(t.toKm != null && !isNaN(t.toKm)) ? Number(t.toKm).toLocaleString('de-DE') : '-'}</div>
                                     <div className="cg-print-cell-bold">{strecke != null ? `${Number(strecke).toLocaleString('de-DE')} km` : '-'}</div>
                                 </div>
                                 <div className="fb-row2 cg-print-row-sub">
                                     <div className="cg-print-cell-muted">{fullAddr || '—'}</div>
                                     <div className="cg-print-cell-name">{t.purpose || '—'}</div>
                                     <div className="cg-print-cell-muted">{t.businessPartner || '—'}</div>
                                     <div className="cg-print-cell-note">{t.note || ''}</div>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
                 <div className="cg-print-summary-wrapper">
                     <div className="cg-print-summary-title">Übersicht Zeitraum</div>
                     <div className="fb-summary-grid cg-print-summary-grid">
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>📋</span> Fahrten</div>
                             <div className="cg-print-summary-value">{currentBusinessTripLog.length}</div>
                         </div>
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>🚐</span> Gesamtstrecke</div>
                             <div className="cg-print-summary-value">{Number(currentBusinessTripLog.reduce((acc:number, t:any) => acc + ((t.toKm != null && t.fromKm != null && !isNaN(t.toKm - t.fromKm)) ? t.toKm - t.fromKm : 0), 0)).toLocaleString('de-DE')} km</div>
                         </div>
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>💼</span> Dienstlich</div>
                             <div className="cg-print-summary-value">{Number(currentBusinessTripLog.filter((t:any) => t.category === 'Dienstlich').reduce((acc:number, t:any) => acc + ((t.toKm != null && t.fromKm != null && !isNaN(t.toKm - t.fromKm)) ? t.toKm - t.fromKm : 0), 0)).toLocaleString('de-DE')} km</div>
                         </div>
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>🏠</span> Privat / Arbeitsweg</div>
                             <div className="cg-print-summary-value">{Number(currentBusinessTripLog.filter((t:any) => t.category !== 'Dienstlich').reduce((acc:number, t:any) => acc + ((t.toKm != null && t.fromKm != null && !isNaN(t.toKm - t.fromKm)) ? t.toKm - t.fromKm : 0), 0)).toLocaleString('de-DE')} km</div>
                         </div>
                     </div>
                 </div>
             </div>
          )}

          {((!selectedArchive && logType === 'spots') || (selectedArchive && archiveViewTab === 'spots')) && (
             printSpots.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <div>
                 <div className="poi-print-column-grid cg-print-col-header">
                     <div style={{textAlign: 'left'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>📅</span> Datum</div>
                     <div style={{textAlign: 'left'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>📍</span> Name</div>
                     <div style={{textAlign: 'left'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>🏷️</span> Kategorie</div>
                     <div style={{textAlign: 'left'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>🌐</span> Koordinaten</div>
                     <div style={{textAlign: 'left', paddingLeft: '2mm'}}><span style={{marginRight: '3px', fontSize: '8pt'}}>📝</span> Notiz</div>
                 </div>
                 <div>
                     {printSpots.map((s:any) => (
                         <div key={s.id} className="poi-print-row cg-print-row">
                             <div className="cg-print-cell-date">{new Date(s.date).toLocaleDateString('de-DE')}</div>
                             <div className="cg-print-cell-name">{s.name}</div>
                             <div className="cg-print-cell-muted">{s.category || 'Stellplatz'}</div>
                             <div className="cg-print-cell-coords">{(s.lat != null && s.lng != null) ? `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}` : ''}</div>
                             <div className="cg-print-cell-note">{s.note}</div>
                         </div>
                     ))}
                 </div>
                 <div className="cg-print-summary-wrapper">
                     <div className="cg-print-summary-title">Übersicht</div>
                     <div className="poi-print-summary-grid cg-print-summary-grid">
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>📍</span> Gespeicherte Orte</div>
                             <div className="cg-print-summary-value">{state.spots.length}</div>
                         </div>
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>🏷️</span> Kategorien</div>
                             <div className="cg-print-summary-value">{new Set(state.spots.map((s:any) => s.category || 'Stellplatz')).size}</div>
                         </div>
                         <div>
                             <div className="cg-print-summary-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>🌐</span> Mit Koordinaten</div>
                             <div className="cg-print-summary-value">{state.spots.filter((s:any) => s.lat != null && s.lng != null).length} von {state.spots.length}</div>
                         </div>
                     </div>
                 </div>
             </div>
          )}

      </div>
  );
}
