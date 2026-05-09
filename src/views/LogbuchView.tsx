import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, FileDown, Printer, MapPin, Archive, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatNumber } from '../lib/formatters';
import { calculateAverageFuelConsumptionFromFuelLog, calculateFuelLogStats } from '../lib/fuelCalculator';
import { PrintHeader } from '../print/PrintHeader';
import type { Currency, FuelType, FuelEntry, SpotEntry } from '../types';

const CURRENCIES: Currency[] = ['EUR', 'CHF', 'TRY', 'DKK', 'SEK', 'NOK', 'PLN', 'GBP'];
const FUEL_TYPES: FuelType[] = ['Diesel', 'Benzin', 'Super E10', 'Super E5'];

export function LogbuchView({ state, setState }: any) {
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

      </div>
    </>
  );
}
