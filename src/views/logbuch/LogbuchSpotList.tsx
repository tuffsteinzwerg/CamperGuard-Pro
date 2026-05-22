import React from 'react';
import { FileDown, Edit2, Trash2, MapPin } from 'lucide-react';
import type { AppState, SpotEntry } from '../../types';

interface LogbuchSpotListProps {
  state: AppState;
  setState: (s: AppState | ((prev: AppState) => AppState)) => void;
  spots: SpotEntry[];
  SPOT_COLORS: Record<string, string>;
  downloadGPX: () => void;
  setSpotForm: (f: any) => void;
  setEditingSpotId: (id: string | null) => void;
  setSpotGpsError: (v: boolean) => void;
  setIsAdding: (v: boolean) => void;
}

export function LogbuchSpotList({
  state, setState, spots, SPOT_COLORS, downloadGPX,
  setSpotForm, setEditingSpotId, setSpotGpsError, setIsAdding
}: LogbuchSpotListProps) {
  return (
          <div className="space-y-3">
              <button onClick={downloadGPX} className="cg-master-button w-full py-2 mb-4 flex flex-row items-center justify-center gap-2"><FileDown size={14}/> GPX Export</button>
              {state.spots.map((spot:any) => (
                  <div key={spot.id} className="cg-master-card-small !p-3 relative border-l-2 !mb-0">
                      <div className="flex flex-col">
                         <div className="flex justify-between items-start">
                             <span className="typo-body-dim">{new Date(spot.date).toLocaleDateString('de-DE')}</span>
                             <div className="flex items-center gap-2">
                                <button onClick={() => { setSpotForm({ date: spot.date, name: spot.name, lat: spot.lat.toString(), lng: spot.lng.toString(), note: spot.note || '', category: spot.category || 'Stellplatz' }); setEditingSpotId(spot.id); setSpotGpsError(false); setIsAdding(true); }} className="cg-master-button !p-1 !rounded flex-shrink-0"><Edit2 size={12}/></button>
                                <button onClick={() => { if(confirm('Möchtest du diesen POI-Eintrag wirklich löschen?')) { setState({...state, spots: state.spots.filter((s:any) => s.id !== spot.id)}); } }} className="cg-master-button-danger !p-1 !rounded flex-shrink-0"><Trash2 size={12}/></button>
                             </div>
                         </div>
                         <div className="flex flex-wrap items-center gap-2 mt-1">
                            <h4 className="typo-card-title">{spot.name}</h4>
                            {spot.category && <span className="typo-label flex items-center gap-1.5"><span className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: SPOT_COLORS[spot.category] || '#9CA3AF' }} />{spot.category}</span>}
                         </div>
                         {spot.note && <p className="typo-body-dim mt-1 break-words line-clamp-2">{spot.note}</p>}
                         <a href={`geo:${spot.lat},${spot.lng}`} className="cg-master-button !py-1 !px-2 mt-2 inline-flex items-center gap-1 w-max"><MapPin size={12}/> {spot.lat.toFixed(4)} / {spot.lng.toFixed(4)}</a>
                      </div>
                  </div>
              ))}
              {state.spots.length === 0 && (
                  <div className="cg-master-card-small !p-6 !mb-0 text-center">
                      <div className="typo-value-large mb-2 opacity-30">📍</div>
                      <div className="typo-card-title mb-1">Noch keine POIs</div>
                      <div className="typo-body-dim cg-master-muted">Speichere deine Lieblings-Stellplätze, Entsorgungsstationen oder Aussichtspunkte. Tippe auf + um einen POI hinzuzufügen.</div>
                  </div>
              )}
          </div>
  );
}
