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
  const [businessTripForm, setBusinessTripForm] = useState({ date: new Date().toISOString().split('T')[0], departureTime: '', arrivalTime: '', fromKm: '', toKm: '', driver: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: '' });
  const [spotForm, setSpotForm] = useState({ date: new Date().toISOString().split('T')[0], name: '', lat: '', lng: '', note: '', category: 'Stellplatz' });
  const [spotGpsError, setSpotGpsError] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  const [tripGpsCoords, setTripGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [tripGpsStatus, setTripGpsStatus] = useState<'offline'|'loading'|'active'>('offline');
  
  const [focusedTankField, setFocusedTankField] = useState<string | null>(null);
  
  const [displayedTripsCount, setDisplayedTripsCount] = useState(5);
  const [displayedBusinessTripsCount, setDisplayedBusinessTripsCount] = useState(10);

  const [tripArchiveForm, setTripArchiveForm] = useState({
      name: '',
      dateFrom: '',
      dateTo: ''
  });

  const [selectedArchive, setSelectedArchive] = useState<any | null>(null);
  const [archiveViewTab, setArchiveViewTab] = useState<'tank' | 'trip' | 'business' | 'spots'>('tank');
  const [isConfirmingBusinessTrip, setIsConfirmingBusinessTrip] = useState(false);
  const [archiveSelection, setArchiveSelection] = useState('tanken');

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

      const currentSpots = (state.spots || []).filter((s:any) => new Date(s.date).getFullYear() === currentYear);

      const archive = {
          id: `archive-year-${currentYear}-${Date.now()}`,
          type: 'year' as const,
          name: String(currentYear),
          year: currentYear,
          dateFrom: `${currentYear}-01-01`,
          dateTo: `${currentYear}-12-31`,
          createdAt: new Date().toISOString(),
          fuelLog: currentFuelLog,
          tripLog: currentTripLog,
          businessTripLog: currentBusinessTripLog,
          spots: currentSpots,
          summary: {
              totalKm,
              totalLiters,
              totalEur,
              fuelConsumption: totalKm > 0 && totalLiters > 0 ? totalLiters / totalKm * 100 : null,
          },
      };

      setState({
          ...state, 
          archives: [...state.archives, archive],
          fuelLog: state.fuelLog.filter((f:any) => new Date(f.date).getFullYear() !== currentYear),
          tripLog: state.tripLog.filter((t:any) => new Date(t.date).getFullYear() !== currentYear),
          businessTripLog: state.businessTripLog.filter((t:any) => new Date(t.date).getFullYear() !== currentYear),
          spots: state.spots.filter((s:any) => new Date(s.date).getFullYear() !== currentYear)
      });
  };

  const createTripArchive = () => {
      if (!tripArchiveForm.name.trim()) {
          alert('Bitte einen Archivnamen eingeben.');
          return;
      }

      if (!tripArchiveForm.dateFrom || !tripArchiveForm.dateTo) {
          alert('Bitte Start- und Enddatum auswählen.');
          return;
      }

      const from = new Date(tripArchiveForm.dateFrom);
      const to = new Date(tripArchiveForm.dateTo);

      if (from > to) {
          alert('Das Startdatum darf nicht nach dem Enddatum liegen.');
          return;
      }

      const isInRange = (dateString: string) => {
          const date = new Date(dateString);
          return date >= from && date <= to;
      };

      const archiveFuelLog = state.fuelLog.filter((f:any) => isInRange(f.date));
      const archiveTripLog = state.tripLog.filter((t:any) => isInRange(t.date));
      const archiveBusinessTripLog = state.businessTripLog.filter((t:any) => isInRange(t.date));
      const archiveSpots = state.spots.filter((s:any) => isInRange(s.date));

      if (
          archiveFuelLog.length === 0 &&
          archiveTripLog.length === 0 &&
          archiveBusinessTripLog.length === 0 &&
          archiveSpots.length === 0
      ) {
          alert('Im gewählten Zeitraum wurden keine Daten gefunden.');
          return;
      }

      const totalKm = archiveTripLog.reduce((sum:number, trip:any) => {
          const diff = Number(trip.toKm || 0) - Number(trip.fromKm || 0);
          return sum + (isNaN(diff) ? 0 : diff);
      }, 0);

      const totalLiters = archiveFuelLog.reduce((sum:number, fuel:any) => {
          return sum + Number(fuel.liters || 0);
      }, 0);

      const totalEur = archiveFuelLog.reduce((sum:number, fuel:any) => {
          return sum + ((Number(fuel.price || 0) * Number(fuel.liters || 0)) / Number(fuel.exchangeRateToEur || 1));
      }, 0);

      const archive = {
          id: `archive-trip-${Date.now()}`,
          type: 'trip' as const,
          name: tripArchiveForm.name.trim(),
          dateFrom: tripArchiveForm.dateFrom,
          dateTo: tripArchiveForm.dateTo,
          createdAt: new Date().toISOString(),
          fuelLog: archiveFuelLog,
          tripLog: archiveTripLog,
          businessTripLog: archiveBusinessTripLog,
          spots: archiveSpots,
          summary: {
              totalKm,
              totalLiters,
              totalEur,
              fuelConsumption: totalKm > 0 && totalLiters > 0 ? totalLiters / totalKm * 100 : null,
          },
      };

      if (!confirm(`Möchtest du die Reise "${archive.name}" wirklich archivieren? Die archivierten Einträge werden aus den aktiven Listen entfernt.`)) {
          return;
      }

      setState({
          ...state,
          archives: [...state.archives, archive],
          fuelLog: state.fuelLog.filter((f:any) => !isInRange(f.date)),
          tripLog: state.tripLog.filter((t:any) => !isInRange(t.date)),
          businessTripLog: state.businessTripLog.filter((t:any) => !isInRange(t.date)),
          spots: state.spots.filter((s:any) => !isInRange(s.date))
      });

      setTripArchiveForm({
          name: '',
          dateFrom: '',
          dateTo: ''
      });
  };

  const deleteArchive = (archive: any) => {
      const isYearArchive = archive.type === 'year';

      const warningText = isYearArchive
          ? 'Dieses Archiv enthält möglicherweise steuerrelevante Fahrtenbuchdaten mit gesetzlicher Aufbewahrungspflicht von bis zu 10 Jahren.'
          : 'Dieses Reise-Archiv wird dauerhaft gelöscht.';

      const firstConfirm = confirm(
          `${warningText}\n\nMöchtest du das Archiv "${archive.name}" wirklich löschen?`
      );

      if (!firstConfirm) return;

      const secondConfirm = confirm(
          `LETZTE WARNUNG:\n\nDas Archiv "${archive.name}" wird unwiderruflich entfernt.\n\nFortfahren?`
      );

      if (!secondConfirm) return;

      setState({
          ...state,
          archives: state.archives.filter((a:any) => a.id !== archive.id)
      });

      if (selectedArchive?.id === archive.id) {
          setSelectedArchive(null);
      }
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

  const printFuelLog = selectedArchive ? selectedArchive.fuelLog : currentFuelLog;
  const printTripLog = selectedArchive ? selectedArchive.tripLog : currentTripLog;
  const printBusinessTripLog = selectedArchive ? selectedArchive.businessTripLog : currentBusinessTripLog;
  const printSpots = selectedArchive ? selectedArchive.spots : state.spots;

  const printTitle = selectedArchive
      ? (
          archiveViewTab === 'tank'
              ? 'Archiv · Tankprotokoll'
              : archiveViewTab === 'trip'
              ? 'Archiv · Reisetagebuch'
              : archiveViewTab === 'business'
              ? 'Archiv · Fahrtenbuch §'
              : 'Archiv · Standorte / POI'
      )
      : (
          logType === 'tank'
              ? 'Tankprotokoll'
              : logType === 'fahrt'
              ? (tripLogMode === 'strict' ? 'Fahrtenbuch §' : 'Reisetagebuch')
              : logType === 'spots'
              ? 'Standorte / POI'
              : 'Archiv'
      );

  const printDateRange = selectedArchive
      ? `${new Date(selectedArchive.dateFrom).toLocaleDateString('de-DE')} – ${new Date(selectedArchive.dateTo).toLocaleDateString('de-DE')}`
      : `01.01.${currentYear} – 31.12.${currentYear}`;

  return (
    <>
      <style>{`
        @media print {
            @page { size: A4 ${logType === 'tank' || (logType === 'fahrt' && tripLogMode === 'strict') ? 'landscape' : 'portrait'}; margin: ${logType === 'tank' ? '15mm' : '10mm 15mm'}; }
            body { background: white !important; }
            .logbuch-normal { display: none !important; }
            .logbuch-print-wrapper { display: block !important; width: 100%; color: black !important; }
            .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; font-family: sans-serif; }
            .print-table th { border-bottom: 2px solid #000; padding: 6px; text-align: left; font-weight: bold; text-transform: uppercase; color: #000 !important; background: transparent !important; }
            .print-table td { border-bottom: 1px solid #ccc; padding: 6px; color: #000 !important; vertical-align: top; }
            .tank-print-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; font-family: sans-serif; }
            .tank-print-table th { border-bottom: 1px solid #666; padding: 4px 2px; text-align: left; font-weight: 500; text-transform: uppercase; color: #333 !important; background: transparent !important; font-size: 8pt; }
            .tank-print-table td { border-bottom: 1px solid #eaeaea; padding: 4px 2px; color: #333 !important; vertical-align: middle; }
            .fahrtenbuch-table { table-layout: fixed; width: 100%; }
            .fahrtenbuch-table th, .fahrtenbuch-table td { overflow-wrap: break-word; word-wrap: break-word; hyphens: auto; }
            .reise-print-column-grid {
                display: grid;
                grid-template-columns: 12% 22% 12% 12% 12% 30%;
            }
            .reise-print-row {
                display: grid;
                grid-template-columns: 12% 22% 12% 12% 12% 30%;
            }
            .reise-print-summary-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
            }
            .poi-print-column-grid {
                display: grid;
                grid-template-columns: 12% 22% 14% 18% 34%;
            }
            .poi-print-row {
                display: grid;
                grid-template-columns: 12% 22% 14% 18% 34%;
            }
            .poi-print-summary-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
            }
            .fb-print-hdr1 {
                display: grid;
                grid-template-columns: 10% 7% 7% 11% 14% 11% 11% 10%;
            }
            .fb-print-hdr2 {
                display: grid;
                grid-template-columns: 30% 25% 25% 20%;
            }
            .fb-row1 {
                display: grid;
                grid-template-columns: 10% 7% 7% 11% 14% 11% 11% 10%;
            }
            .fb-row2 {
                display: grid;
                grid-template-columns: 30% 25% 25% 20%;
            }
            .fb-row1 + .fb-row2 { border-top: 0.15pt dashed #e0e0e0; }
            .fb-summary-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
            }
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
        <button key={t} onClick={() => setLogType(t as any)} className={`cg-master-tab cg-type-tab ${logType === t ? 'cg-master-tab-active' : ''}`}>{t === 'tank' ? 'Tanken' : t === 'spots' ? "POIs" : t === 'fahrt' ? 'Fahrten' : t}</button>
      ))}
  </div>

      {logType === 'tank' && (
          <div className="space-y-3">
            {currentFuelLog.map((entry:any) => {
                const totalLocal = entry.price * entry.liters;
                const totalEur = totalLocal / (entry.exchangeRateToEur || 1);
                return (
                    <div key={entry.id} className="cg-master-card-small !p-3 flex justify-between items-center border-l-2 !border-l-[var(--accent)] !mb-0 gap-3">
                        <div className="flex-1 grid grid-cols-2 gap-y-1 items-center">
                            <div className="text-left flex items-center">
                                <span className="cg-type-meta">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                            </div>
                            <div className="text-right flex items-center justify-end">
                                <span className="cg-type-meta text-[var(--accent)]">{formatNumber(entry.liters, 1)} <span className="cg-type-label ml-0.5">L</span></span>
                            </div>
                            <div className="text-left flex items-center">
                                <span className="cg-type-value">{formatNumber(entry.km, 0)} <span className="cg-type-label ml-0.5">KM</span></span>
                            </div>
                            <div className="text-right flex items-center justify-end">
                                <span className="cg-type-value">{formatNumber(totalLocal, 2)} {entry.currency === 'EUR' ? '€' : entry.currency}</span>
                            </div>
                            <div className="text-left flex items-center">
                                <span className="cg-type-meta">{entry.fuelType}</span>
                            </div>
                            <div className="text-right flex items-center justify-end">
                                <span className="cg-type-meta">
                                    {formatNumber(entry.price, 2)} {entry.currency === 'EUR' ? '€' : entry.currency}/L 
                                    {entry.currency !== 'EUR' && <span className="ml-1 text-[var(--text-tertiary)]">({formatNumber(totalEur, 2)} €)</span>}
                                </span>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <button 
                                onClick={() => {
                                    const totalLocal = entry.price * entry.liters;
                                    setTankForm({
                                        date: entry.date,
                                        km: entry.km.toString(),
                                        liters: entry.liters.toString(),
                                        price: entry.price.toString(),
                                        total: totalLocal.toString()
                                    });
                                    setTimeout(() => {
                                        const fuelTypeEl = document.querySelector('select[name="fuelType"]') as HTMLSelectElement;
                                        if (fuelTypeEl) fuelTypeEl.value = entry.fuelType;
                                        const currencyEl = document.querySelector('select[name="currency"]') as HTMLSelectElement;
                                        if (currencyEl && entry.currency) currencyEl.value = entry.currency;
                                        const vollgetanktEl = document.querySelector('select[name="vollgetankt"]') as HTMLSelectElement;
                                        if (vollgetanktEl) vollgetanktEl.value = entry.vollgetankt === false ? 'false' : 'true';
                                    }, 10);
                                    setEditingTripId(entry.id);
                                    setIsAdding(true);
                                }} 
                                className="cg-master-button !p-2 !rounded flex-shrink-0 -mr-2"
                            >
                                <Edit2 size={16}/>
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
                                                        departureTime: entry.departureTime || '',
                                                        arrivalTime: entry.arrivalTime || '',
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
              <div className="cg-master-card space-y-6">
                  <div className="space-y-4">
                      <h3 className="cg-type-value flex items-center gap-2 mb-3"><Archive size={14}/> Jahresabschluss</h3>
                      <button 
                          className="cg-master-button-danger w-full py-3"
                          onClick={() => {
                              closeYear();
                          }}
                      >
                          Jahr archivieren
                      </button>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                      <h3 className="cg-type-value flex items-center gap-2 mb-3"><Archive size={14}/> Reise archivieren</h3>

                      <input
                          type="text"
                          placeholder="z. B. Skandinavien-Tour 2026"
                          value={tripArchiveForm.name}
                          onChange={(e) => setTripArchiveForm({...tripArchiveForm, name: e.target.value})}
                          className="cg-master-input"
                      />

                      <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                              <label className="cg-type-meta">Von</label>
                              <input
                                  type="date"
                                  value={tripArchiveForm.dateFrom}
                                  onChange={(e) => setTripArchiveForm({...tripArchiveForm, dateFrom: e.target.value})}
                                  className="cg-master-input"
                              />
                          </div>

                          <div className="space-y-1">
                              <label className="cg-type-meta">Bis</label>
                              <input
                                  type="date"
                                  value={tripArchiveForm.dateTo}
                                  onChange={(e) => setTripArchiveForm({...tripArchiveForm, dateTo: e.target.value})}
                                  className="cg-master-input"
                              />
                          </div>
                      </div>

                      <button
                          onClick={createTripArchive}
                          className="cg-master-button w-full py-3"
                      >
                          Reise archivieren
                      </button>
                  </div>
              </div>
              
              {state.archives.map((a:any) => (
                  <button
                      key={a.id || a.year}
                      onClick={() => {
                          setSelectedArchive(a);
                          setArchiveViewTab('tank');
                      }}
                      className="cg-master-card-small !p-4 !mb-0 w-full text-left"
                  >
                      <div className="flex items-start justify-between gap-3 pb-2 mb-2 border-b border-[var(--border)]">
                          <div className="flex flex-col gap-1">
                              <h3 className="cg-type-value-large flex items-center gap-2">
                                  <Archive size={14}/>
                                  {a.name || a.year}
                              </h3>

                              <div className="flex flex-wrap items-center gap-2">
                                  <span className="cg-type-meta uppercase tracking-wide">
                                      {a.type === 'trip' ? 'Reisearchiv' : 'Jahresabschluss'}
                                  </span>

                                  <span className="cg-type-meta">
                                      {new Date(a.dateFrom).toLocaleDateString('de-DE')}
                                      {' — '}
                                      {new Date(a.dateTo).toLocaleDateString('de-DE')}
                                  </span>
                              </div>
                          </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center mt-3">
                          <div>
                              <div className="cg-type-label text-[var(--text-muted)]">Distanz</div>
                              <div className="cg-type-value">{formatNumber(a.summary?.totalKm ?? a.totalKm, 0)} <span className="cg-type-label ml-0.5">KM</span></div>
                          </div>
                          <div>
                              <div className="cg-type-label text-[var(--text-muted)]">Liter</div>
                              <div className="cg-type-value">{formatNumber(a.summary?.totalLiters ?? a.totalLiters, 1)} <span className="cg-type-label ml-0.5">L</span></div>
                          </div>
                          <div>
                              <div className="cg-type-label text-[var(--text-muted)]">Kosten</div>
                              <div className="cg-type-value text-[var(--accent)]">{formatNumber(a.summary?.totalEur ?? a.totalEur, 2)} <span className="cg-type-label ml-0.5">€</span></div>
                          </div>
                      </div>
                  </button>
              ))}
              {state.archives.length === 0 && <div className="text-center cg-type-meta py-8">Keine Archive</div>}
          </div>
      )}

      {(logType === 'tank' || logType === 'fahrt' || logType === 'spots') && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md h-9 z-40 pointer-events-none flex items-center justify-center">
              <div className="pointer-events-auto absolute right-4 bottom-0">
                  <button 
                    onClick={() => { 
                        const highestKm = getLastKnownKm();
                        if (logType === 'tank') {
                            setTankForm(f => ({...f, date: new Date().toISOString().split('T')[0], km: highestKm > 0 ? highestKm.toString() : ''})); 
                        } else if (logType === 'fahrt') {
                            setTripForm(f => ({...f, date: new Date().toISOString().split('T')[0], fromKm: highestKm > 0 ? highestKm.toString() : '', toKm: '', destination: '', purpose: '', category: '', note: ''}));
                            setBusinessTripForm(f => ({...f, date: new Date().toISOString().split('T')[0], departureTime: '', arrivalTime: '', fromKm: highestKm > 0 ? highestKm.toString() : '', toKm: '', driver: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: ''}));
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
                    <Plus size={20} strokeWidth={3} className="text-[var(--accent)]" />
                  </button>
              </div>
          </div>
      )}

      <AnimatePresence>
        {selectedArchive && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/95 flex items-start justify-center p-4 overflow-y-auto"
            >
                <div className="w-full max-w-4xl my-8 space-y-4">
                    <div className="cg-master-card">
                        <div className="flex justify-between items-start gap-4">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="cg-type-meta uppercase tracking-wide">
                                        {selectedArchive.type === 'trip' ? 'Reisearchiv' : 'Jahresabschluss'}
                                    </span>
                                </div>

                                <h2 className="cg-type-page-title !text-left">
                                    {selectedArchive.name}
                                </h2>

                                <div className="cg-type-meta">
                                    {new Date(selectedArchive.dateFrom).toLocaleDateString('de-DE')}
                                    {' — '}
                                    {new Date(selectedArchive.dateTo).toLocaleDateString('de-DE')}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => deleteArchive(selectedArchive)}
                                    className="cg-master-button-danger !p-2"
                                >
                                    Löschen
                                </button>

                                <button
                                    onClick={() => window.print()}
                                    className="cg-master-button !p-2"
                                >
                                    Drucken
                                </button>

                                <button
                                    onClick={() => setSelectedArchive(null)}
                                    className="cg-master-button !p-2"
                                >
                                    Schließen
                                </button>
                            </div>
                        </div>

                        {selectedArchive.type === 'year' && (
                            <div className="cg-master-card-small !mb-0 !p-3 border border-[var(--status-warning)] bg-[rgba(255,165,0,0.08)]">
                                <div className="cg-type-meta leading-relaxed">
                                    Dieses Jahresarchiv kann steuerrelevante Fahrtenbuchdaten enthalten.
                                    Gesetzliche Aufbewahrungsfristen können bis zu 10 Jahre betragen.
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            <div className="cg-master-card-small !mb-0 !p-3">
                                <div className="cg-type-label">KM</div>
                                <div className="cg-type-value-large">
                                    {formatNumber(selectedArchive.summary?.totalKm || 0, 0)}
                                </div>
                            </div>

                            <div className="cg-master-card-small !mb-0 !p-3">
                                <div className="cg-type-label">Liter</div>
                                <div className="cg-type-value-large">
                                    {formatNumber(selectedArchive.summary?.totalLiters || 0, 1)}
                                </div>
                            </div>

                            <div className="cg-master-card-small !mb-0 !p-3">
                                <div className="cg-type-label">Kosten</div>
                                <div className="cg-type-value-large text-[var(--accent)]">
                                    {formatNumber(selectedArchive.summary?.totalEur || 0, 2)} €
                                </div>
                            </div>

                            <div className="cg-master-card-small !mb-0 !p-3">
                                <div className="cg-type-label">Verbrauch</div>
                                <div className="cg-type-value-large">
                                    {selectedArchive.summary?.fuelConsumption != null
                                        ? `${formatNumber(selectedArchive.summary.fuelConsumption, 1)} L`
                                        : '—'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="cg-master-inset cg-master-tabs p-1 overflow-x-auto hide-scrollbar">
                        <button
                            onClick={() => setArchiveViewTab('tank')}
                            className={`cg-master-tab cg-type-tab ${archiveViewTab === 'tank' ? 'cg-master-tab-active' : ''}`}
                        >
                            Tanken
                        </button>

                        <button
                            onClick={() => setArchiveViewTab('trip')}
                            className={`cg-master-tab cg-type-tab ${archiveViewTab === 'trip' ? 'cg-master-tab-active' : ''}`}
                        >
                            Reisen
                        </button>

                        <button
                            onClick={() => setArchiveViewTab('business')}
                            className={`cg-master-tab cg-type-tab ${archiveViewTab === 'business' ? 'cg-master-tab-active' : ''}`}
                        >
                            Fahrtenbuch §
                        </button>

                        <button
                            onClick={() => setArchiveViewTab('spots')}
                            className={`cg-master-tab cg-type-tab ${archiveViewTab === 'spots' ? 'cg-master-tab-active' : ''}`}
                        >
                            POIs
                        </button>
                    </div>

                    {archiveViewTab === 'tank' && (
                        <div className="space-y-3">
                            {selectedArchive.fuelLog.map((entry:any) => (
                                <div key={entry.id} className="cg-master-card-small !p-3 !mb-0">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="space-y-1">
                                            <div className="cg-type-meta">
                                                {new Date(entry.date).toLocaleDateString('de-DE')}
                                            </div>

                                            <div className="cg-type-card-title">
                                                {entry.km?.toLocaleString('de-DE')} KM
                                            </div>

                                            <div className="cg-type-meta">
                                                {formatNumber(entry.liters, 1)} L · {formatNumber(entry.price, 3)} {entry.currency || '€'}
                                            </div>
                                        </div>

                                        <div className="cg-type-value text-[var(--accent)]">
                                            {formatNumber((entry.liters * entry.price) / (entry.exchangeRateToEur || 1), 2)} €
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {selectedArchive.fuelLog.length === 0 && (
                                <div className="cg-type-meta text-center py-8">
                                    Keine archivierten Tankeinträge
                                </div>
                            )}
                        </div>
                    )}

                    {archiveViewTab === 'trip' && (
                        <div className="space-y-3">
                            {selectedArchive.tripLog.map((entry:any) => (
                                <div key={entry.id} className="cg-master-card-small !p-3 border-l-2 !border-l-[var(--accent)] !mb-0">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="space-y-1">
                                            <div className="cg-type-meta">
                                                {new Date(entry.date).toLocaleDateString('de-DE')}
                                            </div>

                                            <div className="cg-type-card-title">
                                                {entry.destination}
                                            </div>

                                            {entry.purpose && (
                                                <div className="cg-type-meta">
                                                    {entry.purpose}
                                                </div>
                                            )}

                                            {entry.note && (
                                                <div className="cg-type-meta italic">
                                                    {entry.note}
                                                </div>
                                            )}
                                        </div>

                                        <div className="cg-type-value text-[var(--accent)]">
                                            +{formatNumber((entry.toKm || 0) - (entry.fromKm || 0), 0)} KM
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {selectedArchive.tripLog.length === 0 && (
                                <div className="cg-type-meta text-center py-8">
                                    Keine archivierten Reisen
                                </div>
                            )}
                        </div>
                    )}

                    {archiveViewTab === 'business' && (
                        <div className="space-y-3">
                            {selectedArchive.businessTripLog.map((entry:any) => (
                                <div key={entry.id} className="cg-master-card-small !p-3 !mb-0">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-start gap-3">
                                            <div>
                                                <div className="cg-type-meta">
                                                    {new Date(entry.date).toLocaleDateString('de-DE')}
                                                </div>

                                                <div className="cg-type-card-title">
                                                    {entry.city ? `${entry.zip} ${entry.city}` : 'Fahrtenbuch'}
                                                </div>
                                            </div>

                                            <div className="cg-type-value text-[var(--accent)]">
                                                +{formatNumber((entry.toKm || 0) - (entry.fromKm || 0), 0)} KM
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <span className="cg-type-meta">
                                                {entry.departureTime || '—'} → {entry.arrivalTime || '—'}
                                            </span>

                                            <span className="cg-type-meta">
                                                {entry.category}
                                            </span>
                                        </div>

                                        {entry.purpose && (
                                            <div className="cg-type-meta">
                                                {entry.purpose}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {selectedArchive.businessTripLog.length === 0 && (
                                <div className="cg-type-meta text-center py-8">
                                    Keine archivierten Fahrtenbuch-Einträge
                                </div>
                            )}
                        </div>
                    )}

                    {archiveViewTab === 'spots' && (
                        <div className="space-y-3">
                            {selectedArchive.spots.map((entry:any) => (
                                <div key={entry.id} className="cg-master-card-small !p-3 !mb-0">
                                    <div className="space-y-1">
                                        <div className="cg-type-meta">
                                            {new Date(entry.date).toLocaleDateString('de-DE')}
                                        </div>

                                        <div className="cg-type-card-title">
                                            {entry.name}
                                        </div>

                                        <div className="cg-type-meta">
                                            {entry.category}
                                        </div>

                                        <div className="cg-type-meta text-[var(--accent)]">
                                            {Number(entry.lat).toFixed(4)}, {Number(entry.lng).toFixed(4)}
                                        </div>

                                        {entry.note && (
                                            <div className="cg-type-meta italic">
                                                {entry.note}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {selectedArchive.spots.length === 0 && (
                                <div className="cg-type-meta text-center py-8">
                                    Keine archivierten POIs
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        )}

        {isAdding && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 overflow-y-auto">
                <div className="cg-master-card-small w-full max-w-sm my-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="typo-section-title">{logType === 'tank' ? 'Tankbeleg' : logType === 'fahrt' ? (tripLogMode === 'strict' ? 'Fahrtenbuch' : 'Reise-Notiz') : "POI Log"}</h2>
                        {logType === 'tank' && editingTripId && (
                            <button
                                type="button"
                                onClick={() => {
                                    if(confirm('Möchtest du diesen Tankbeleg wirklich löschen?')) {
                                        setState({...state, fuelLog: state.fuelLog.filter((f:any) => f.id !== editingTripId)});
                                        setEditingTripId(null);
                                        setIsAdding(false);
                                    }
                                }}
                                className="cg-master-button-danger !p-1.5 !rounded flex-shrink-0"
                            >
                                <Trash2 size={16}/>
                            </button>
                        )}
                    </div>
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
                                            {isLitersValid && tankForm.liters !== '' && parseFloat(tankForm.liters) > 250 && <span className="typo-tiny block mt-1 text-[var(--accent)] opacity-80">Literangabe wirkt ungewöhnlich hoch.</span>}
                                        </div>
                                        <select name="fuelType" className="cg-master-select w-full">
                                            {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="w-full">
                                            <input name="price" required type={focusedTankField === 'price' ? "number" : "text"} min="0.01" step="0.001" max="999" placeholder="Preis/Liter" value={focusedTankField === 'price' ? tankForm.price : (tankForm.price !== '' && !isNaN(parseFloat(tankForm.price)) ? parseFloat(tankForm.price).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : tankForm.price)} onChange={handleTankChange} onFocus={() => setFocusedTankField('price')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className={`cg-master-input w-full`} />
                                            {!isPriceValid && tankForm.price !== '' && <span className="typo-tiny block mt-1 cg-master-muted">Preis muss &gt; 0 und &lt;= 999 sein.</span>}
                                            {isPriceValid && tankForm.price !== '' && parseFloat(tankForm.price) > 5 && <span className="typo-tiny block mt-1 text-[var(--accent)] opacity-80">Preis/Liter wirkt ungewöhnlich hoch.</span>}
                                        </div>
                                        <div className="w-full">
                                            <input name="total" type={focusedTankField === 'total' ? "number" : "text"} min="0" step="0.01" placeholder="Gesamtbetrag" value={focusedTankField === 'total' ? tankForm.total : (tankForm.total !== '' && !isNaN(parseFloat(tankForm.total)) ? parseFloat(tankForm.total).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : tankForm.total)} onChange={handleTankChange} onFocus={() => setFocusedTankField('total')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className="cg-master-input w-full" />
                                            {tankForm.total !== '' && !isNaN(parseFloat(tankForm.total)) && parseFloat(tankForm.total) > 500 && <span className="typo-tiny block mt-1 text-[var(--accent)] opacity-80">Gesamtbetrag wirkt ungewöhnlich hoch.</span>}
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
                                            <option value="Wohnung – Arbeitsstätte">Wohnung – Arbeitsstätte</option>
                                            <option value="Privat">Privat</option>
                                        </select>
                                        <input name="driver" required placeholder="Fahrer" value={businessTripForm.driver} onChange={e => setBusinessTripForm({...businessTripForm, driver: e.target.value})} className={`cg-master-input w-full`} />
                                        {!isBusinessTripDriverValid && businessTripForm.driver === '' && <span className="typo-tiny block mt-1 cg-master-muted">Fahrer ist ein Pflichtfeld.</span>}
                                        <div className="flex gap-2">
                                            <input name="departureTime" type={businessTripForm.departureTime ? 'time' : 'text'} placeholder="Abfahrt (Uhrzeit)" value={businessTripForm.departureTime} onFocus={e => { e.target.type = 'time'; }} onBlur={e => { if (!e.target.value) e.target.type = 'text'; }} onChange={e => setBusinessTripForm({...businessTripForm, departureTime: e.target.value})} className="cg-master-input w-1/2" />
                                            <input name="arrivalTime" type={businessTripForm.arrivalTime ? 'time' : 'text'} placeholder="Ankunft (Uhrzeit)" value={businessTripForm.arrivalTime} onFocus={e => { e.target.type = 'time'; }} onBlur={e => { if (!e.target.value) e.target.type = 'text'; }} onChange={e => setBusinessTripForm({...businessTripForm, arrivalTime: e.target.value})} className="cg-master-input w-1/2" />
                                        </div>
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
    </>
  );
}
