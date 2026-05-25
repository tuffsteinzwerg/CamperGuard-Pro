import React from 'react';
import { Trash2, MapPin, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { formatNumber } from '../../lib/formatters';
import type { Currency, FuelType, FuelEntry, SpotEntry, AppState, TripEntry, BusinessTripEntry } from '../../types';

const CURRENCIES: Currency[] = ['EUR', 'CHF', 'TRY', 'DKK', 'SEK', 'NOK', 'PLN', 'GBP'];
const FUEL_TYPES: FuelType[] = ['Diesel', 'Benzin', 'Super E10', 'Super E5'];

const SPOT_COLORS: Record<string, string> = {
  'Stellplatz': '#3B82F6',
  'Freistehen': '#22C55E',
  'Campingplatz': '#FBBF24',
  'Entsorgung': '#EF4444',
  'Versorgung': '#EC4899',
  'Einkauf': '#06B6D4',
  'Aussicht': '#A855F7',
  'Sonstiges': '#9CA3AF',
};

const SPOT_CATEGORIES = ['Stellplatz', 'Freistehen', 'Campingplatz', 'Entsorgung', 'Versorgung', 'Einkauf', 'Aussicht', 'Sonstiges'];

interface LogbuchAddModalProps {
  isAdding: boolean;
  setIsAdding: (v: boolean) => void;
  isConfirmingBusinessTrip: boolean;
  setIsConfirmingBusinessTrip: (v: boolean) => void;
  logType: 'tank' | 'fahrt' | 'spots' | 'archiv';
  tripLogMode: 'flex' | 'strict';
  // Tank
  tankForm: Record<string, string>;
  setTankForm: (f: FuelEntry) => void;
  handleTankChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  focusedTankField: string | null;
  setFocusedTankField: (f: string | null) => void;
  isKmValid: boolean;
  isLitersValid: boolean;
  isPriceValid: boolean;
  minKm: number;
  maxKm: number;
  // Trip
  tripForm: Record<string, string>;
  setTripForm: (f: FuelEntry) => void;
  businessTripForm: Record<string, string>;
  setBusinessTripForm: (f: FuelEntry) => void;
  isTripValid: boolean;
  isBusinessTripValid: boolean;
  isBusinessTripPurposeValid: boolean;
  isBusinessTripDriverValid: boolean;
  isBusinessTripCategoryValid: boolean;
  isBusinessTripToday: boolean;
  tripGpsCoords: { lat: number; lng: number } | null;
  tripGpsStatus: 'offline' | 'loading' | 'active';
  // Spot
  spotForm: Record<string, string>;
  setSpotForm: (f: FuelEntry) => void;
  spotCategoryOpen: boolean;
  setSpotCategoryOpen: (v: boolean) => void;
  spotGpsError: boolean;
  setSpotGpsError: (v: boolean) => void;
  getPosition: () => Promise<{ lat: number; lng: number }>;
  // Shared
  editingTripId: string | null;
  setEditingTripId: (id: string | null) => void;
  editingSpotId: string | null;
  setEditingSpotId: (id: string | null) => void;
  getLastKnownKm: () => number;
  state: AppState;
  setState: (s: AppState | ((prev: AppState) => AppState)) => void;
}

export function LogbuchAddModal(props: LogbuchAddModalProps) {
  const {
    isAdding, setIsAdding, isConfirmingBusinessTrip, setIsConfirmingBusinessTrip,
    logType, tripLogMode,
    tankForm, setTankForm, handleTankChange, focusedTankField, setFocusedTankField,
    isKmValid, isLitersValid, isPriceValid, minKm, maxKm,
    tripForm, setTripForm, businessTripForm, setBusinessTripForm,
    isTripValid, isBusinessTripValid, isBusinessTripPurposeValid,
    isBusinessTripDriverValid, isBusinessTripCategoryValid, isBusinessTripToday,
    tripGpsCoords, tripGpsStatus,
    spotForm, setSpotForm, spotCategoryOpen, setSpotCategoryOpen,
    spotGpsError, setSpotGpsError, getPosition,
    editingTripId, setEditingTripId, editingSpotId, setEditingSpotId,
    getLastKnownKm, state, setState
  } = props;

  return (
    <>
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
                                        setState({...state, fuelLog: state.fuelLog.filter((f: FuelEntry) => f.id !== editingTripId)});
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
                    <form onSubmit={(e: React.FormEvent) => {
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
                                const entry: TripEntry = { 
                                    id: editingTripId || Date.now().toString(), 
                                    date: tripForm.date, 
                                    fromKm: editingTripId ? (state.tripLog.find((t: TripEntry) => t.id === editingTripId)?.fromKm ?? getLastKnownKm()) : getLastKnownKm(), 
                                    toKm: isNaN(parsedToKm) ? 0 : parsedToKm, 
                                    purpose: tripForm.purpose, 
                                    destination: tripForm.destination, 
                                    note: tripForm.note,
                                    lat: editingTripId ? (state.tripLog.find((t: TripEntry) => t.id === editingTripId)?.lat ?? undefined) : (tripGpsCoords?.lat || undefined),
                                    lng: editingTripId ? (state.tripLog.find((t: TripEntry) => t.id === editingTripId)?.lng ?? undefined) : (tripGpsCoords?.lng || undefined)
                                };
                                if (editingTripId) {
                                    setState({...state, tripLog: state.tripLog.map((t: TripEntry) => t.id === editingTripId ? entry : t)});
                                } else {
                                    setState({...state, tripLog: [entry, ...state.tripLog]});
                                }
                                setEditingTripId(null);
                                setIsAdding(false);
                            }
                        } else if(logType === 'spots') {
                            const entry: SpotEntry = { id: editingSpotId || Date.now().toString(), name: spotForm.name, date: spotForm.date, lat: parseFloat(spotForm.lat), lng: parseFloat(spotForm.lng), note: spotForm.note, category: spotForm.category };
                            if (editingSpotId) {
                                setState({...state, spots: state.spots.map((s: SpotEntry) => s.id === editingSpotId ? entry : s)});
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
                                                <span className="typo-body-dim text-[var(--accent)]">GPS: {tripGpsCoords.lat.toFixed(5)}, {tripGpsCoords.lng.toFixed(5)}</span>
                                                <span className="typo-body-dim cg-master-muted ml-auto">wird gespeichert</span>
                                            </div>
                                        )}
                                        {editingTripId && (() => {
                                            const existingEntry = state.tripLog.find((t: TripEntry) => t.id === editingTripId);
                                            if (existingEntry?.lat && existingEntry?.lng) {
                                                return (
                                                    <a href={`https://www.google.com/maps?q=${existingEntry.lat},${existingEntry.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-[var(--bg-card)] no-underline" style={{ textDecoration: 'none' }}>
                                                        <MapPin size={14} className="text-[var(--accent)] shrink-0"/>
                                                        <span className="typo-body-dim text-[var(--accent)]">GPS: {existingEntry.lat.toFixed(5)}, {existingEntry.lng.toFixed(5)}</span>
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
                                    <div className="relative w-full">
                                        <button
                                            type="button"
                                            onClick={() => setSpotCategoryOpen(!spotCategoryOpen)}
                                            className="cg-master-input w-full flex items-center gap-2 text-left"
                                        >
                                            <span className="w-[10px] h-[10px] rounded-full flex-shrink-0 border border-white/30" style={{ background: SPOT_COLORS[spotForm.category] || '#9CA3AF' }} />
                                            <span className="flex-1">{spotForm.category}</span>
                                            <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${spotCategoryOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {spotCategoryOpen && (
                                            <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] shadow-xl overflow-y-auto max-h-[240px]">
                                                {SPOT_CATEGORIES.map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => { setSpotForm({...spotForm, category: cat}); setSpotCategoryOpen(false); }}
                                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${spotForm.category === cat ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                                    >
                                                        <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: SPOT_COLORS[cat] }} />
                                                        <span className={spotForm.category === cat ? 'text-white font-bold' : 'text-[var(--text-secondary)]'}>{cat}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
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
        {isConfirmingBusinessTrip && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm" style={{ borderColor: 'var(--accent)' }}>
                    <h2 className="typo-section-title mb-2">Verbindlich Speichern?</h2>
                    <p className="typo-body mb-6">
                        Bitte prüfe alle Angaben sorgfältig.<br/><br/>Fahrtenbuch-Einträge sind nur am selben Tag änderbar und danach gesperrt.<br/><br/>Möchtest du diesen Eintrag verbindlich speichern?
                    </p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => {
                            const entry: BusinessTripEntry = { 
                                id: editingTripId || Date.now().toString(), 
                                date: businessTripForm.date, 
                                departureTime: businessTripForm.departureTime || '',
                                arrivalTime: businessTripForm.arrivalTime || '',
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
                                setState({...state, businessTripLog: currentBusinessTrips.map((t: BusinessTripEntry) => t.id === editingTripId ? entry : t)});
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
    </>
  );
}
