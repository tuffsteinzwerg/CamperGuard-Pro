import React from 'react';
import { Archive as ArchiveIcon } from 'lucide-react';
import { formatNumber } from '../../lib/formatters';
import type { AppState, Archive } from '../../types';

interface LogbuchArchiveCreateProps {
  state: AppState;
  archiveSelection: string;
  setArchiveSelection: (s: string) => void;
  // Reise-Archiv
  tripArchiveName: string;
  setTripArchiveName: (s: string) => void;
  tripArchiveFrom: string;
  setTripArchiveFrom: (s: string) => void;
  tripArchiveTo: string;
  setTripArchiveTo: (s: string) => void;
  createTripArchive: () => void;
  // Fuel
  fuelArchiveMode: 'all' | 'range';
  setFuelArchiveMode: (m: 'all' | 'range') => void;
  fuelArchiveRange: { from: string; to: string };
  setFuelArchiveRange: (r: { from: string; to: string }) => void;
  createFuelArchive: () => void;
  // Trip
  tripArchiveMode: 'all' | 'range';
  setTripArchiveMode: (m: 'all' | 'range') => void;
  tripArchiveRange: { from: string; to: string };
  setTripArchiveRange: (r: { from: string; to: string }) => void;
  createTripLogArchive: () => void;
  // Business
  businessArchiveMode: 'all' | 'range';
  setBusinessArchiveMode: (m: 'all' | 'range') => void;
  businessArchiveRange: { from: string; to: string };
  setBusinessArchiveRange: (r: { from: string; to: string }) => void;
  createBusinessTripArchive: () => void;
  // Spots
  spotsArchiveMode: 'all' | 'range';
  setSpotsArchiveMode: (m: 'all' | 'range') => void;
  spotsArchiveRange: { from: string; to: string };
  setSpotsArchiveRange: (r: { from: string; to: string }) => void;
  createSpotsArchive: () => void;
  // Archiv-Liste
  setSelectedArchive: (a: Archive) => void;
  setArchiveViewTab: (t: 'tank' | 'trip' | 'business' | 'spots') => void;
}

export function LogbuchArchiveCreate(props: LogbuchArchiveCreateProps) {
  const {
    state, archiveSelection, setArchiveSelection,
    tripArchiveName, setTripArchiveName, tripArchiveFrom, setTripArchiveFrom,
    tripArchiveTo, setTripArchiveTo, createTripArchive,
    fuelArchiveMode, setFuelArchiveMode, fuelArchiveRange, setFuelArchiveRange, createFuelArchive,
    tripArchiveMode, setTripArchiveMode, tripArchiveRange, setTripArchiveRange, createTripLogArchive,
    businessArchiveMode, setBusinessArchiveMode, businessArchiveRange, setBusinessArchiveRange, createBusinessTripArchive,
    spotsArchiveMode, setSpotsArchiveMode, spotsArchiveRange, setSpotsArchiveRange, createSpotsArchive,
    setSelectedArchive, setArchiveViewTab
  } = props;

  return (
          <div className="space-y-4">
              <div className="cg-master-card-small !p-4 !mb-2">
                  <h3 className="typo-value-normal flex items-center gap-2 mb-3"><ArchiveIcon size={14}/> Archiv erstellen</h3>
                  <div className="space-y-3">
                      <div className="flex gap-2 items-center">
                          <select 
                              className="cg-master-input flex-1 !py-2" 
                              value={archiveSelection} 
                              onChange={(e) => setArchiveSelection(e.target.value)}
                          >
                              <option value="reise">Reise archivieren</option>
                              <option value="tanken">Tankprotokoll</option>
                              <option value="reisetagebuch">Reisetagebuch</option>
                              <option value="fahrtenbuch">Fahrtenbuch §</option>
                              <option value="pois">POIs</option>
                          </select>
                      </div>

                      {archiveSelection === 'reise' && (
                          <div className="space-y-3">
                              <input
                                  type="text"
                                  placeholder="Name der Reise (z.B. Norwegen 2025)"
                                  value={tripArchiveName}
                                  onChange={(e) => setTripArchiveName(e.target.value)}
                                  className="cg-master-input w-full"
                                  maxLength={60}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                  <div>
                                      <label className="typo-label block mb-1">Von</label>
                                      <input
                                          type="date"
                                          value={tripArchiveFrom}
                                          onChange={(e) => setTripArchiveFrom(e.target.value)}
                                          className="cg-master-input w-full"
                                      />
                                  </div>
                                  <div>
                                      <label className="typo-label block mb-1">Bis</label>
                                      <input
                                          type="date"
                                          value={tripArchiveTo}
                                          onChange={(e) => setTripArchiveTo(e.target.value)}
                                          className="cg-master-input w-full"
                                      />
                                  </div>
                              </div>
                              <div className="cg-master-card-small !p-3 !mb-0">
                                  <div className="typo-body-dim leading-relaxed">
                                      Alle Tankungen, Fahrten, Fahrtenbuch-Einträge und POIs im gewählten Zeitraum werden zusammengefasst und aus den aktiven Listen entfernt.
                                  </div>
                              </div>
                              <button
                                  className="cg-master-button !py-2 px-4 w-full"
                                  onClick={createTripArchive}
                              >
                                  Reise archivieren
                              </button>
                          </div>
                      )}

                      {archiveSelection === 'tanken' && (
                          <div className="space-y-3">
                              <select
                                  className="cg-master-input !py-2 w-full"
                                  value={fuelArchiveMode}
                                  onChange={(e) => setFuelArchiveMode(e.target.value as 'all' | 'range')}
                              >
                                  <option value="all">Alle Tankungen archivieren</option>
                                  <option value="range">Tankungen nach Zeitraum archivieren</option>
                              </select>

                              {fuelArchiveMode === 'range' && (
                                  <div className="grid grid-cols-2 gap-2">
                                      <input
                                          type="date"
                                          value={fuelArchiveRange.from}
                                          onChange={(e) => setFuelArchiveRange({
                                              ...fuelArchiveRange,
                                              from: e.target.value
                                          })}
                                          className="cg-master-input"
                                      />

                                      <input
                                          type="date"
                                          value={fuelArchiveRange.to}
                                          onChange={(e) => setFuelArchiveRange({
                                              ...fuelArchiveRange,
                                              to: e.target.value
                                          })}
                                          className="cg-master-input"
                                      />
                                  </div>
                              )}

                              <button 
                                  className="cg-master-button !py-2 px-4 w-full"
                                  onClick={createFuelArchive}
                              >
                                  Tankprotokoll archivieren
                              </button>
                          </div>
                      )}

                      {archiveSelection === 'reisetagebuch' && (
                          <div className="space-y-3">
                              <select
                                  className="cg-master-input !py-2 w-full"
                                  value={tripArchiveMode}
                                  onChange={(e) => setTripArchiveMode(e.target.value as 'all' | 'range')}
                              >
                                  <option value="all">Alle Reisen archivieren</option>
                                  <option value="range">Reisen nach Zeitraum archivieren</option>
                              </select>

                              {tripArchiveMode === 'range' && (
                                  <div className="grid grid-cols-2 gap-2">
                                      <input
                                          type="date"
                                          value={tripArchiveRange.from}
                                          onChange={(e) => setTripArchiveRange({
                                              ...tripArchiveRange,
                                              from: e.target.value
                                          })}
                                          className="cg-master-input"
                                      />

                                      <input
                                          type="date"
                                          value={tripArchiveRange.to}
                                          onChange={(e) => setTripArchiveRange({
                                              ...tripArchiveRange,
                                              to: e.target.value
                                          })}
                                          className="cg-master-input"
                                      />
                                  </div>
                              )}

                              <button 
                                  className="cg-master-button !py-2 px-4 w-full"
                                  onClick={createTripLogArchive}
                              >
                                  Reisetagebuch archivieren
                              </button>
                          </div>
                      )}

                      {archiveSelection === 'fahrtenbuch' && (
                          <div className="space-y-3">
                              <select
                                  className="cg-master-input !py-2 w-full"
                                  value={businessArchiveMode}
                                  onChange={(e) => setBusinessArchiveMode(e.target.value as 'all' | 'range')}
                              >
                                  <option value="all">Alle Einträge archivieren</option>
                                  <option value="range">Einträge nach Zeitraum archivieren</option>
                              </select>

                              {businessArchiveMode === 'range' && (
                                  <div className="grid grid-cols-2 gap-2">
                                      <input
                                          type="date"
                                          value={businessArchiveRange.from}
                                          onChange={(e) => setBusinessArchiveRange({
                                              ...businessArchiveRange,
                                              from: e.target.value
                                          })}
                                          className="cg-master-input"
                                      />
                                      <input
                                          type="date"
                                          value={businessArchiveRange.to}
                                          onChange={(e) => setBusinessArchiveRange({
                                              ...businessArchiveRange,
                                              to: e.target.value
                                          })}
                                          className="cg-master-input"
                                      />
                                  </div>
                              )}

                              <button 
                                  className="cg-master-button !py-2 px-4 w-full"
                                  onClick={createBusinessTripArchive}
                              >
                                  Fahrtenbuch § archivieren
                              </button>
                          </div>
                      )}

                      {archiveSelection === 'pois' && (
                          <div className="space-y-3">
                              <select
                                  className="cg-master-input !py-2 w-full"
                                  value={spotsArchiveMode}
                                  onChange={(e) => setSpotsArchiveMode(e.target.value as 'all' | 'range')}
                              >
                                  <option value="all">Alle POIs archivieren</option>
                                  <option value="range">POIs nach Zeitraum archivieren</option>
                              </select>

                              {spotsArchiveMode === 'range' && (
                                  <div className="grid grid-cols-2 gap-2">
                                      <input
                                          type="date"
                                          value={spotsArchiveRange.from}
                                          onChange={(e) => setSpotsArchiveRange({
                                              ...spotsArchiveRange,
                                              from: e.target.value
                                          })}
                                          className="cg-master-input"
                                      />
                                      <input
                                          type="date"
                                          value={spotsArchiveRange.to}
                                          onChange={(e) => setSpotsArchiveRange({
                                              ...spotsArchiveRange,
                                              to: e.target.value
                                          })}
                                          className="cg-master-input"
                                      />
                                  </div>
                              )}

                              <button 
                                  className="cg-master-button !py-2 px-4 w-full"
                                  onClick={createSpotsArchive}
                              >
                                  POIs archivieren
                              </button>
                          </div>
                      )}
                  </div>
              </div>
              
              {state.archives.map((a:any) => (
                  <button
                      key={a.id || a.year}
                      onClick={() => {
                          setSelectedArchive(a);
                          if (a.type === 'triplog') {
                              setArchiveViewTab('trip');
                          } else if (a.type === 'business') {
                              setArchiveViewTab('business');
                          } else if (a.type === 'spots') {
                              setArchiveViewTab('spots');
                          } else {
                              setArchiveViewTab('tank');
                          }
                      }}
                      className="cg-master-card-small !p-4 !mb-0 w-full text-left"
                  >
                      <div className="flex items-start justify-between gap-3 pb-2 mb-2 border-b border-[var(--border)]">
                          <div className="flex flex-col gap-1">
                              <h3 className="typo-value-large flex items-center gap-2">
                                  <ArchiveIcon size={14}/>
                                  {a.name || a.year}
                              </h3>

                              <div className="flex flex-wrap items-center gap-2">
                                  <span className="typo-body-dim uppercase tracking-wide">
                                      {a.type === 'year' ? 'Jahresabschluss' : a.type === 'fuel' ? 'Tankprotokoll' : a.type === 'triplog' ? 'Reisetagebuch' : a.type === 'business' ? 'Fahrtenbuch §' : a.type === 'spots' ? 'POI-Archiv' : 'Reisearchiv'}
                                  </span>

                                  <span className="typo-body-dim">
                                      {new Date(a.dateFrom).toLocaleDateString('de-DE')}
                                      {' — '}
                                      {new Date(a.dateTo).toLocaleDateString('de-DE')}
                                  </span>
                              </div>
                          </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center mt-3">
                          <div>
                              <div className="typo-label text-[var(--text-muted)]">Distanz</div>
                              <div className="typo-value-normal">{formatNumber(a.summary?.totalKm ?? a.totalKm, 0)} <span className="typo-label ml-0.5">KM</span></div>
                          </div>
                          <div>
                              <div className="typo-label text-[var(--text-muted)]">Liter</div>
                              <div className="typo-value-normal">{formatNumber(a.summary?.totalLiters ?? a.totalLiters, 1)} <span className="typo-label ml-0.5">L</span></div>
                          </div>
                          <div>
                              <div className="typo-label text-[var(--text-muted)]">Kosten</div>
                              <div className="typo-value-normal text-[var(--accent)]">{formatNumber(a.summary?.totalEur ?? a.totalEur, 2)} <span className="typo-label ml-0.5">€</span></div>
                          </div>
                      </div>
                  </button>
              ))}
              {state.archives.length === 0 && <div className="text-center typo-body-dim py-8">Keine Archive</div>}
          </div>
        )
      }
