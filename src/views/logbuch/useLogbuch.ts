import { createUuid } from "../../lib/uuid.ts";
import { useState, useEffect, useMemo } from 'react';
import { calculateAverageFuelConsumptionFromFuelLog, calculateFuelLogStats } from '../../lib/fuelCalculator';
import type { Currency, FuelType, FuelEntry, SpotEntry, AppState, TripEntry, BusinessTripEntry, Archive } from '../../types';

export function useLogbuch(state: AppState, setState: (s: AppState | ((prev: AppState) => AppState)) => void) {
  const [logType, setLogType] = useState<'tank' | 'fahrt' | 'spots' | 'archiv'>('tank');
  const [tripLogMode, setTripLogMode] = useState<'flex' | 'strict'>('flex');
  const [isAdding, setIsAdding] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentFuelLog = useMemo(() => {
      const filtered = state.fuelLog.filter((f: FuelEntry) => new Date(f.date).getFullYear() === currentYear);
      return filtered.sort((a: FuelEntry, b: FuelEntry) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff === 0) return b.km - a.km;
          return dateDiff;
      });
  }, [state.fuelLog, currentYear]);
  const currentTripLog = useMemo(() => state.tripLog.filter((t: TripEntry) => new Date(t.date).getFullYear() === currentYear), [state.tripLog, currentYear]);
  const currentBusinessTripLog = useMemo(() => (state.businessTripLog || []).filter((t: BusinessTripEntry) => new Date(t.date).getFullYear() === currentYear).sort((a: BusinessTripEntry, b: BusinessTripEntry) => new Date(b.date).getTime() - new Date(a.date).getTime()), [state.businessTripLog, currentYear]);
  
  const totalLiters = currentFuelLog.reduce((acc: number, f: FuelEntry) => acc + f.liters, 0);
  const totalEur = currentFuelLog.reduce((acc: number, f: FuelEntry) => acc + (f.liters * f.price / (f.exchangeRateToEur || 1)), 0);
  const totalKm = currentTripLog.reduce((acc: number, t: TripEntry) => acc + (t.toKm - t.fromKm), 0);

  const result = calculateAverageFuelConsumptionFromFuelLog(currentFuelLog);

  const [tankForm, setTankForm] = useState({ date: new Date().toISOString().split('T')[0], km: '', liters: '', price: '', total: '' });
  const [tripForm, setTripForm] = useState({ date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', destination: '', purpose: '', category: '', note: '' });
  const [businessTripForm, setBusinessTripForm] = useState({ date: new Date().toISOString().split('T')[0], departureTime: '', arrivalTime: '', fromKm: '', toKm: '', driver: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: '' });
  const [spotForm, setSpotForm] = useState({ date: new Date().toISOString().split('T')[0], name: '', lat: '', lng: '', note: '', category: 'Stellplatz' });
  const [spotGpsError, setSpotGpsError] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  const [spotCategoryOpen, setSpotCategoryOpen] = useState(false);
  const [tripGpsCoords, setTripGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [tripGpsStatus, setTripGpsStatus] = useState<'offline'|'loading'|'active'>('offline');
  
  const [focusedTankField, setFocusedTankField] = useState<string | null>(null);
  
  const [displayedTripsCount, setDisplayedTripsCount] = useState(5);
  const [displayedBusinessTripsCount, setDisplayedBusinessTripsCount] = useState(10);

  const [selectedArchive, setSelectedArchive] = useState<any | null>(null);
  const [archiveViewTab, setArchiveViewTab] = useState<'tank' | 'trip' | 'business' | 'spots'>('tank');

  const [fuelArchiveMode, setFuelArchiveMode] = useState<'all' | 'range'>('all');

  const [fuelArchiveRange, setFuelArchiveRange] = useState({
      from: '',
      to: ''
  });

  const [tripArchiveMode, setTripArchiveMode] = useState<'all' | 'range'>('all');

  const [tripArchiveRange, setTripArchiveRange] = useState({
      from: '',
      to: ''
  });
  const [isConfirmingBusinessTrip, setIsConfirmingBusinessTrip] = useState(false);
  const [archiveSelection, setArchiveSelection] = useState('tanken');

  const [businessArchiveMode, setBusinessArchiveMode] = useState<'all' | 'range'>('all');
  const [businessArchiveRange, setBusinessArchiveRange] = useState({ from: '', to: '' });

  const [spotsArchiveMode, setSpotsArchiveMode] = useState<'all' | 'range'>('all');
  const [spotsArchiveRange, setSpotsArchiveRange] = useState({ from: '', to: '' });

  const [tripArchiveName, setTripArchiveName] = useState('');
  const [tripArchiveFrom, setTripArchiveFrom] = useState('');
  const [tripArchiveTo, setTripArchiveTo] = useState('');

  const getLastKnownKm = (): number => {
    let highestKm = 0;
    (state.fuelLog || []).forEach((e: FuelEntry) => highestKm = Math.max(highestKm, Number(e.km) || 0));
    (state.tripLog || []).forEach((e: TripEntry) => highestKm = Math.max(highestKm, Number(e.toKm) || 0));
    (state.businessTripLog || []).forEach((e: BusinessTripEntry) => highestKm = Math.max(highestKm, Number(e.toKm) || 0));
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

  state.fuelLog.forEach((f: FuelEntry) => {
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

  const handleTankChange = (e: any) => {
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
    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Guard4Campers">\n';
    state.spots.forEach((s: SpotEntry) => {
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

  const createFuelArchive = () => {
      let archiveFuelLog = [...state.fuelLog];

      if (fuelArchiveMode === 'range') {
          if (!fuelArchiveRange.from || !fuelArchiveRange.to) {
              alert('Bitte Von- und Bis-Datum auswählen.');
              return;
          }

          archiveFuelLog = state.fuelLog.filter((f: FuelEntry) => {
              return (
                  f.date >= fuelArchiveRange.from &&
                  f.date <= fuelArchiveRange.to
              );
          });

          if (archiveFuelLog.length === 0) {
              alert('Keine Tankungen im gewählten Zeitraum gefunden.');
              return;
          }
      }

      if (archiveFuelLog.length === 0) {
          alert('Keine Tankungen zum Archivieren vorhanden.');
          return;
      }

      const totalLiters = archiveFuelLog.reduce((sum: number, fuel: FuelEntry) => {
          return sum + Number(fuel.liters || 0);
      }, 0);

      const totalEur = archiveFuelLog.reduce((sum: number, fuel: FuelEntry) => {
          return sum + ((Number(fuel.price || 0) * Number(fuel.liters || 0)) / Number(fuel.exchangeRateToEur || 1));
      }, 0);

      const sortedByKm = [...archiveFuelLog]
          .filter((f: FuelEntry) => !isNaN(Number(f.km)))
          .sort((a: FuelEntry, b: FuelEntry) => Number(a.km) - Number(b.km));

      const totalKm =
          sortedByKm.length >= 2
              ? Number(sortedByKm[sortedByKm.length - 1].km) - Number(sortedByKm[0].km)
              : 0;

      const archiveDateFrom =
          fuelArchiveMode === 'range'
              ? fuelArchiveRange.from
              : archiveFuelLog
                    .map((f: FuelEntry) => f.date)
                    .sort()[0];

      const archiveDateTo =
          fuelArchiveMode === 'range'
              ? fuelArchiveRange.to
              : archiveFuelLog
                    .map((f: FuelEntry) => f.date)
                    .sort()
                    .slice(-1)[0];

      const archive: Archive = {
          id: createUuid(),
          type: 'fuel',
          name: `Tankprotokoll ${new Date().toLocaleDateString('de-DE')}`,
          dateFrom: archiveDateFrom,
          dateTo: archiveDateTo,
          createdAt: new Date().toISOString(),
          fuelLog: archiveFuelLog,
          tripLog: [],
          businessTripLog: [],
          spots: [],
          summary: {
              totalKm,
              totalLiters,
              totalEur,
              fuelConsumption: calculateAverageFuelConsumptionFromFuelLog(archiveFuelLog).consumption,
          },
      };

      if (!confirm(`Tankprotokoll archivieren?\n\n${archiveFuelLog.length} Tankungen werden archiviert und aus dem aktiven Tankprotokoll entfernt.`)) {
          return;
      }

      const archivedIds = new Set(archiveFuelLog.map((f: FuelEntry) => f.id));

      setState({
          ...state,
          archives: [...state.archives, archive],
          fuelLog: state.fuelLog.filter((f: FuelEntry) => !archivedIds.has(f.id))
      });

      setFuelArchiveMode('all');

      setFuelArchiveRange({
          from: '',
          to: ''
      });
  };

  const createTripLogArchive = () => {
      let archiveTripLog = [...currentTripLog];

      if (tripArchiveMode === 'range') {
          if (!tripArchiveRange.from || !tripArchiveRange.to) {
              alert('Bitte Von- und Bis-Datum auswählen.');
              return;
          }

          archiveTripLog = state.tripLog.filter((t: TripEntry) => {
              return (
                  t.date >= tripArchiveRange.from &&
                  t.date <= tripArchiveRange.to
              );
          });

          if (archiveTripLog.length === 0) {
              alert('Keine Reisen im gewählten Zeitraum gefunden.');
              return;
          }
      }

      if (archiveTripLog.length === 0) {
          alert('Keine Reisen zum Archivieren vorhanden.');
          return;
      }

      const totalKm = archiveTripLog.reduce((sum: number, trip: TripEntry) => {
          const diff = Number(trip.toKm || 0) - Number(trip.fromKm || 0);
          return sum + (isNaN(diff) ? 0 : diff);
      }, 0);

      const archiveDateFrom =
          tripArchiveMode === 'range'
              ? tripArchiveRange.from
              : archiveTripLog
                    .map((t: TripEntry) => t.date)
                    .sort()[0];

      const archiveDateTo =
          tripArchiveMode === 'range'
              ? tripArchiveRange.to
              : archiveTripLog
                    .map((t: TripEntry) => t.date)
                    .sort()
                    .slice(-1)[0];

      const archive: Archive = {
          id: createUuid(),
          type: 'triplog',
          name: `Reisetagebuch ${new Date().toLocaleDateString('de-DE')}`,
          dateFrom: archiveDateFrom,
          dateTo: archiveDateTo,
          createdAt: new Date().toISOString(),
          fuelLog: [],
          tripLog: archiveTripLog,
          businessTripLog: [],
          spots: [],
          summary: {
              totalKm,
              totalLiters: 0,
              totalEur: 0,
              fuelConsumption: null,
          },
      };

      if (!confirm(`Reisetagebuch archivieren?\n\n${archiveTripLog.length} Einträge werden archiviert und aus dem aktiven Reisetagebuch entfernt.`)) {
          return;
      }

      const archivedIds = new Set(archiveTripLog.map((t: TripEntry) => t.id));

      setState({
          ...state,
          archives: [...state.archives, archive],
          tripLog: state.tripLog.filter((t: TripEntry) => !archivedIds.has(t.id))
      });

      setTripArchiveMode('all');

      setTripArchiveRange({
          from: '',
          to: ''
      });
  };

  const createBusinessTripArchive = () => {
      let archiveBusinessLog = [...currentBusinessTripLog];

      if (businessArchiveMode === 'range') {
          if (!businessArchiveRange.from || !businessArchiveRange.to) {
              alert('Bitte Von- und Bis-Datum auswählen.');
              return;
          }

          archiveBusinessLog = (state.businessTripLog || []).filter((t: BusinessTripEntry) => {
              return (
                  t.date >= businessArchiveRange.from &&
                  t.date <= businessArchiveRange.to
              );
          });

          if (archiveBusinessLog.length === 0) {
              alert('Keine Fahrtenbuch-Einträge im gewählten Zeitraum gefunden.');
              return;
          }
      }

      if (archiveBusinessLog.length === 0) {
          alert('Keine Fahrtenbuch-Einträge zum Archivieren vorhanden.');
          return;
      }

      const totalKm = archiveBusinessLog.reduce((sum: number, trip: TripEntry) => {
          const diff = Number(trip.toKm || 0) - Number(trip.fromKm || 0);
          return sum + (isNaN(diff) ? 0 : diff);
      }, 0);

      const archiveDateFrom =
          businessArchiveMode === 'range'
              ? businessArchiveRange.from
              : archiveBusinessLog
                    .map((t: TripEntry) => t.date)
                    .sort()[0];

      const archiveDateTo =
          businessArchiveMode === 'range'
              ? businessArchiveRange.to
              : archiveBusinessLog
                    .map((t: TripEntry) => t.date)
                    .sort()
                    .slice(-1)[0];

      const archive: Archive = {
          id: createUuid(),
          type: 'business',
          name: `Fahrtenbuch § ${new Date().toLocaleDateString('de-DE')}`,
          dateFrom: archiveDateFrom,
          dateTo: archiveDateTo,
          createdAt: new Date().toISOString(),
          fuelLog: [],
          tripLog: [],
          businessTripLog: archiveBusinessLog,
          spots: [],
          summary: {
              totalKm,
              totalLiters: 0,
              totalEur: 0,
              fuelConsumption: null,
          },
      };

      if (!confirm(`Fahrtenbuch § archivieren?\n\n${archiveBusinessLog.length} Einträge werden archiviert und aus dem aktiven Fahrtenbuch entfernt.`)) {
          return;
      }

      const archivedIds = new Set(archiveBusinessLog.map((t: BusinessTripEntry) => t.id));

      setState({
          ...state,
          archives: [...state.archives, archive],
          businessTripLog: (state.businessTripLog || []).filter((t: BusinessTripEntry) => !archivedIds.has(t.id))
      });

      setBusinessArchiveMode('all');
      setBusinessArchiveRange({ from: '', to: '' });
  };

  const createSpotsArchive = () => {
      let archiveSpots = [...(state.spots || [])];

      if (spotsArchiveMode === 'range') {
          if (!spotsArchiveRange.from || !spotsArchiveRange.to) {
              alert('Bitte Von- und Bis-Datum auswählen.');
              return;
          }

          archiveSpots = (state.spots || []).filter((s: SpotEntry) => {
              return (
                  s.date >= spotsArchiveRange.from &&
                  s.date <= spotsArchiveRange.to
              );
          });

          if (archiveSpots.length === 0) {
              alert('Keine POIs im gewählten Zeitraum gefunden.');
              return;
          }
      }

      if (archiveSpots.length === 0) {
          alert('Keine POIs zum Archivieren vorhanden.');
          return;
      }

      const archiveDateFrom =
          spotsArchiveMode === 'range'
              ? spotsArchiveRange.from
              : archiveSpots
                    .map((s: SpotEntry) => s.date)
                    .sort()[0];

      const archiveDateTo =
          spotsArchiveMode === 'range'
              ? spotsArchiveRange.to
              : archiveSpots
                    .map((s: SpotEntry) => s.date)
                    .sort()
                    .slice(-1)[0];

      const archive: Archive = {
          id: createUuid(),
          type: 'spots',
          name: `POIs ${new Date().toLocaleDateString('de-DE')}`,
          dateFrom: archiveDateFrom,
          dateTo: archiveDateTo,
          createdAt: new Date().toISOString(),
          fuelLog: [],
          tripLog: [],
          businessTripLog: [],
          spots: archiveSpots,
          summary: {
              totalKm: 0,
              totalLiters: 0,
              totalEur: 0,
              fuelConsumption: null,
          },
      };

      if (!confirm(`POIs archivieren?\n\n${archiveSpots.length} Einträge werden archiviert und aus der aktiven POI-Liste entfernt.`)) {
          return;
      }

      const archivedIds = new Set(archiveSpots.map((s: SpotEntry) => s.id));

      setState({
          ...state,
          archives: [...state.archives, archive],
          spots: (state.spots || []).filter((s: SpotEntry) => !archivedIds.has(s.id))
      });

      setSpotsArchiveMode('all');
      setSpotsArchiveRange({ from: '', to: '' });
  };

  const createTripArchive = () => {
      if (!tripArchiveName.trim()) {
          alert('Bitte einen Namen für das Reise-Archiv eingeben.');
          return;
      }
      if (!tripArchiveFrom || !tripArchiveTo) {
          alert('Bitte Von- und Bis-Datum auswählen.');
          return;
      }
      if (tripArchiveFrom > tripArchiveTo) {
          alert('Das Von-Datum muss vor dem Bis-Datum liegen.');
          return;
      }

      const inRange = (date: string) => date >= tripArchiveFrom && date <= tripArchiveTo;

      const archiveFuel = state.fuelLog.filter((f: FuelEntry) => inRange(f.date));
      const archiveTrips = state.tripLog.filter((t: TripEntry) => inRange(t.date));
      const archiveBusiness = (state.businessTripLog || []).filter((t: BusinessTripEntry) => inRange(t.date));
      const archiveSpots = (state.spots || []).filter((s: SpotEntry) => inRange(s.date));

      const totalEntries = archiveFuel.length + archiveTrips.length + archiveBusiness.length + archiveSpots.length;

      if (totalEntries === 0) {
          alert('Keine Einträge im gewählten Zeitraum gefunden.');
          return;
      }

      const totalLiters = archiveFuel.reduce((sum: number, f: FuelEntry) => sum + Number(f.liters || 0), 0);
      const totalEur = archiveFuel.reduce((sum: number, f: FuelEntry) => sum + ((Number(f.price || 0) * Number(f.liters || 0)) / Number(f.exchangeRateToEur || 1)), 0);

      const allKmSources = [
          ...archiveFuel.filter((f: FuelEntry) => !isNaN(Number(f.km))).map((f: FuelEntry) => Number(f.km)),
          ...archiveTrips.map((t: TripEntry) => [Number(t.fromKm || 0), Number(t.toKm || 0)]).flat(),
          ...archiveBusiness.map((t: BusinessTripEntry) => [Number(t.fromKm || 0), Number(t.toKm || 0)]).flat(),
      ].filter((km) => !isNaN(km) && km > 0);

      const totalKm = allKmSources.length >= 2
          ? Math.max(...allKmSources) - Math.min(...allKmSources)
          : 0;

      const archive: Archive = {
          id: createUuid(),
          type: 'trip',
          name: tripArchiveName.trim(),
          dateFrom: tripArchiveFrom,
          dateTo: tripArchiveTo,
          createdAt: new Date().toISOString(),
          fuelLog: archiveFuel,
          tripLog: archiveTrips,
          businessTripLog: archiveBusiness,
          spots: archiveSpots,
          summary: {
              totalKm,
              totalLiters,
              totalEur,
              fuelConsumption: calculateAverageFuelConsumptionFromFuelLog(archiveFuel).consumption,
          },
      };

      const details = [
          archiveFuel.length > 0 ? `${archiveFuel.length} Tankungen` : null,
          archiveTrips.length > 0 ? `${archiveTrips.length} Fahrten` : null,
          archiveBusiness.length > 0 ? `${archiveBusiness.length} Fahrtenbuch-Einträge` : null,
          archiveSpots.length > 0 ? `${archiveSpots.length} POIs` : null,
      ].filter(Boolean).join(', ');

      if (!confirm(`Reise "${tripArchiveName.trim()}" archivieren?\n\n${details}\n\nDiese Einträge werden archiviert und aus den aktiven Listen entfernt.`)) {
          return;
      }

      const fuelIds = new Set(archiveFuel.map((f: FuelEntry) => f.id));
      const tripIds = new Set(archiveTrips.map((t: TripEntry) => t.id));
      const businessIds = new Set(archiveBusiness.map((t: BusinessTripEntry) => t.id));
      const spotIds = new Set(archiveSpots.map((s: SpotEntry) => s.id));

      setState({
          ...state,
          archives: [...state.archives, archive],
          fuelLog: state.fuelLog.filter((f: FuelEntry) => !fuelIds.has(f.id)),
          tripLog: state.tripLog.filter((t: TripEntry) => !tripIds.has(t.id)),
          businessTripLog: (state.businessTripLog || []).filter((t: BusinessTripEntry) => !businessIds.has(t.id)),
          spots: (state.spots || []).filter((s: SpotEntry) => !spotIds.has(s.id)),
      });

      setTripArchiveName('');
      setTripArchiveFrom('');
      setTripArchiveTo('');
  };

  const deleteArchive = (archive: Archive) => {
      const isYearArchive = archive.type === 'year' || archive.type === 'triplog' || archive.type === 'business';

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
          archives: state.archives.filter((a: Archive) => a.id !== archive.id)
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

  return {
    // Tab State
    logType, setLogType,
    tripLogMode, setTripLogMode,
    isAdding, setIsAdding,
    
    // Berechnete Werte
    currentYear,
    currentFuelLog,
    currentTripLog,
    currentBusinessTripLog,
    totalLiters,
    totalEur,
    totalKm,
    result,
    
    // Tank Form
    tankForm, setTankForm,
    handleTankChange,
    focusedTankField, setFocusedTankField,
    isKmValid, isLitersValid, isPriceValid,
    minKm, maxKm,
    
    // Trip Form
    tripForm, setTripForm,
    businessTripForm, setBusinessTripForm,
    isTripValid,
    isBusinessTripValid,
    isBusinessTripPurposeValid,
    isBusinessTripDriverValid,
    isBusinessTripCategoryValid,
    isBusinessTripToday,
    tripGpsCoords, tripGpsStatus,
    isConfirmingBusinessTrip, setIsConfirmingBusinessTrip,
    
    // Spot Form
    spotForm, setSpotForm,
    spotCategoryOpen, setSpotCategoryOpen,
    spotGpsError, setSpotGpsError,
    getPosition,
    
    // Shared Edit State
    editingTripId, setEditingTripId,
    editingSpotId, setEditingSpotId,
    displayedTripsCount, setDisplayedTripsCount,
    displayedBusinessTripsCount, setDisplayedBusinessTripsCount,
    
    // Archive State
    selectedArchive, setSelectedArchive,
    archiveViewTab, setArchiveViewTab,
    archiveSelection, setArchiveSelection,
    fuelArchiveMode, setFuelArchiveMode,
    fuelArchiveRange, setFuelArchiveRange,
    tripArchiveMode, setTripArchiveMode,
    tripArchiveRange, setTripArchiveRange,
    businessArchiveMode, setBusinessArchiveMode,
    businessArchiveRange, setBusinessArchiveRange,
    spotsArchiveMode, setSpotsArchiveMode,
    spotsArchiveRange, setSpotsArchiveRange,
    tripArchiveName, setTripArchiveName,
    tripArchiveFrom, setTripArchiveFrom,
    tripArchiveTo, setTripArchiveTo,
    
    // Archive Funktionen
    createFuelArchive,
    createTripLogArchive,
    createBusinessTripArchive,
    createSpotsArchive,
    createTripArchive,
    deleteArchive,
    
    // Sonstige
    downloadGPX,
    getLastKnownKm,
    fuelStats,
    printFuelLog, printTripLog, printBusinessTripLog, printSpots,
    printTitle, printDateRange,
  };
}
