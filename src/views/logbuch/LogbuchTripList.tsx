import React from 'react';
import { Edit2, Trash2, MapPin } from 'lucide-react';
import { formatNumber } from '../../lib/formatters';
import type { AppState, TripEntry, BusinessTripEntry } from '../../types';

interface LogbuchTripListProps {
  state: AppState;
  setState: (s: AppState | ((prev: AppState) => AppState)) => void;
  tripLogMode: 'flex' | 'strict';
  setTripLogMode: (m: 'flex' | 'strict') => void;
  currentTripLog: TripEntry[];
  currentBusinessTripLog: BusinessTripEntry[];
  displayedTripsCount: number;
  setDisplayedTripsCount: React.Dispatch<React.SetStateAction<number>>;
  displayedBusinessTripsCount: number;
  setDisplayedBusinessTripsCount: React.Dispatch<React.SetStateAction<number>>;
  setTripForm: (f: any) => void;
  setBusinessTripForm: (f: any) => void;
  setEditingTripId: (id: string | null) => void;
  setIsAdding: (v: boolean) => void;
}

export function LogbuchTripList(props: LogbuchTripListProps) {
  const {
    state, setState, tripLogMode, setTripLogMode,
    currentTripLog, currentBusinessTripLog,
    displayedTripsCount, setDisplayedTripsCount,
    displayedBusinessTripsCount, setDisplayedBusinessTripsCount,
    setTripForm, setBusinessTripForm, setEditingTripId, setIsAdding
  } = props;

  return (
    <div className="space-y-4">
        <div className="cg-master-card-small !p-2 !mb-0 flex bg-[var(--bg-app)]">
            <button onClick={() => setTripLogMode('flex')} className={`flex-1 text-center py-2 text-sm font-medium rounded ${tripLogMode === 'flex' ? 'bg-[var(--accent)] text-white shadow' : 'text-[var(--text-muted)]'}`}>Reisetagebuch</button>
            <button onClick={() => setTripLogMode('strict')} className={`flex-1 text-center py-2 text-sm font-medium rounded ${tripLogMode === 'strict' ? 'bg-[var(--accent)] text-white shadow' : 'text-[var(--text-muted)]'}`}>Fahrtenbuch §</button>
        </div>

        {tripLogMode === 'flex' && (
            <div className="space-y-3">
                {currentTripLog.slice(0, displayedTripsCount).map((entry: any) => (
                    <div key={entry.id} className="cg-master-card-small !p-3">
                        <div className="flex justify-between items-start gap-3">
                            <div className="space-y-1">
                                <div className="typo-body-dim">{new Date(entry.date).toLocaleDateString('de-DE')}</div>
                                <div className="typo-card-title">{entry.destination}</div>
                                {entry.fromKm != null && entry.toKm != null && <div className="typo-body-dim text-xs text-[var(--accent)]">{formatNumber(entry.toKm - entry.fromKm, 0)} km</div>}
                                {entry.note && <div className="typo-body-dim italic text-xs">{entry.note}</div>}
                            </div>
                            <button onClick={() => { setTripForm(entry); setEditingTripId(entry.id); setIsAdding(true); }} className="p-2 text-[var(--text-muted)] hover:text-[var(--accent)]"><Edit2 size={16}/></button>
                        </div>
                    </div>
                ))}
                {currentTripLog.length === 0 && <div className="text-center typo-body-dim py-8">Noch keine Fahrten</div>}
                {currentTripLog.length > displayedTripsCount && (
                    <button onClick={() => setDisplayedTripsCount(prev => prev + 10)} className="cg-master-button w-full py-2">Mehr anzeigen</button>
                )}
            </div>
        )}

        {tripLogMode === 'strict' && (
            <div className="space-y-3">
                <div className="cg-master-card-small !mb-0 !p-3 border border-orange-500/20 bg-orange-500/5">
                    <div className="typo-body-dim text-orange-400">Das Fahrtenbuch dient dem Nachweis geschäftlicher Fahrten gegenüber dem Finanzamt. Bitte wenden Sie sich zur rechtlichen Prüfung an Ihren Steuerberater.</div>
                </div>
                {currentBusinessTripLog.slice(0, displayedBusinessTripsCount).map((entry: any) => (
                    <div key={entry.id} className="cg-master-card-small !p-3">
                        <div className="flex justify-between items-start gap-3">
                            <div className="space-y-1">
                                <div className="typo-body-dim">{new Date(entry.date).toLocaleDateString('de-DE')}</div>
                                <div className="typo-card-title">{entry.city ? `${entry.zip} ${entry.city}` : 'Fahrtenbuch'}</div>
                                <div className="flex gap-2">
                                   <span className="typo-body-dim min-w-[70px]">{entry.departureTime || '-'} → {entry.arrivalTime || '-'}</span>
                                   <span className="typo-body-dim text-[var(--accent)]">{formatNumber(entry.toKm - entry.fromKm, 0)} km</span>
                                </div>
                            </div>
                            <button onClick={() => { setBusinessTripForm(entry); setEditingTripId(entry.id); setIsAdding(true); }} className="p-2 text-[var(--text-muted)] hover:text-[var(--accent)]"><Edit2 size={16}/></button>
                        </div>
                    </div>
                ))}
                {currentBusinessTripLog.length === 0 && <div className="text-center typo-body-dim py-8">Noch keine Fahrtenbuch-Einträge</div>}
                {currentBusinessTripLog.length > displayedBusinessTripsCount && (
                    <button onClick={() => setDisplayedBusinessTripsCount(prev => prev + 10)} className="cg-master-button w-full py-2">Mehr anzeigen</button>
                )}
            </div>
        )}
    </div>
  );
}
