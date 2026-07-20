import React from 'react';
import { Archive, CheckCircle, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { formatNumber } from '../../lib/formatters';
import type { Archive as ArchiveType, FuelEntry } from '../../types';

interface LogbuchArchiveDetailProps {
  selectedArchive: ArchiveType | null;
  setSelectedArchive: (a: ArchiveType | null) => void;
  archiveViewTab: 'tank' | 'trip' | 'business' | 'spots';
  setArchiveViewTab: (t: 'tank' | 'trip' | 'business' | 'spots') => void;
  deleteArchive: (archive: ArchiveType) => void;
}

export function LogbuchArchiveDetail({
  selectedArchive, setSelectedArchive,
  archiveViewTab, setArchiveViewTab,
  deleteArchive
}: LogbuchArchiveDetailProps) {
  if (!selectedArchive) return null;

  return (
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
                                    <span className="typo-body-dim uppercase tracking-wide">
                                        {selectedArchive.type === 'year' ? 'Jahresabschluss' : selectedArchive.type === 'fuel' ? 'Tankprotokoll' : selectedArchive.type === 'triplog' ? 'Reisetagebuch' : selectedArchive.type === 'business' ? 'Fahrtenbuch §' : selectedArchive.type === 'spots' ? 'POI-Archiv' : 'Reisearchiv'}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-[11px] font-bold text-green-400 uppercase tracking-wide">
                                        <CheckCircle size={11} />
                                        Archiviert
                                    </span>
                                </div>

                                <h2 className="typo-section-title !text-left">
                                    {selectedArchive.name}
                                </h2>

                                <div className="typo-body-dim">
                                    {new Date(selectedArchive.dateFrom).toLocaleDateString('de-DE')}
                                    {' — '}
                                    {new Date(selectedArchive.dateTo).toLocaleDateString('de-DE')}
                                </div>
                                {selectedArchive.createdAt && (
                                    <div className="typo-body-dim text-[var(--text-muted)]">
                                        Archiviert am {new Date(selectedArchive.createdAt).toLocaleDateString('de-DE')}
                                    </div>
                                )}
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

                        {(selectedArchive.type === 'year' || selectedArchive.type === 'triplog' || selectedArchive.type === 'business') && (
                            <div className="cg-master-card-small !mb-0 !p-3 border border-[var(--status-warning)] bg-[rgba(255,165,0,0.08)]">
                                <div className="typo-body-dim leading-relaxed">
                                    Dieses Jahresarchiv kann steuerrelevante Fahrtenbuchdaten enthalten.
                                    Gesetzliche Aufbewahrungsfristen können bis zu 10 Jahre betragen.
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            <div className="cg-master-card-small !mb-0 !p-3">
                                <div className="typo-label">KM</div>
                                <div className="typo-value-large">
                                    {formatNumber(selectedArchive.summary?.totalKm || 0, 0)}
                                </div>
                            </div>

                            <div className="cg-master-card-small !mb-0 !p-3">
                                <div className="typo-label">Liter</div>
                                <div className="typo-value-large">
                                    {formatNumber(selectedArchive.summary?.totalLiters || 0, 1)}
                                </div>
                            </div>

                            <div className="cg-master-card-small !mb-0 !p-3">
                                <div className="typo-label">Kosten</div>
                                <div className="typo-value-large text-[var(--accent)]">
                                    {formatNumber(selectedArchive.summary?.totalEur || 0, 2)} €
                                </div>
                            </div>

                            <div className="cg-master-card-small !mb-0 !p-3">
                                <div className="typo-label">Verbrauch</div>
                                <div className="typo-value-large">
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
                            className={`cg-master-tab typo-label ${archiveViewTab === 'tank' ? 'cg-master-tab-active' : ''}`}
                        >
                            Tanken
                        </button>

                        <button
                            onClick={() => setArchiveViewTab('trip')}
                            className={`cg-master-tab typo-label ${archiveViewTab === 'trip' ? 'cg-master-tab-active' : ''}`}
                        >
                            Reisen
                        </button>

                        <button
                            onClick={() => setArchiveViewTab('business')}
                            className={`cg-master-tab typo-label ${archiveViewTab === 'business' ? 'cg-master-tab-active' : ''}`}
                        >
                            Fahrtenbuch §
                        </button>

                        <button
                            onClick={() => setArchiveViewTab('spots')}
                            className={`cg-master-tab typo-label ${archiveViewTab === 'spots' ? 'cg-master-tab-active' : ''}`}
                        >
                            POIs
                        </button>
                    </div>

                    {archiveViewTab === 'tank' && (
                        <div className="space-y-3">
                            {selectedArchive.fuelLog.map((entry: any) => (
                                <div key={entry.id} className="cg-master-card-small !p-3 !mb-0">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="space-y-1">
                                            <div className="typo-body-dim">
                                                {new Date(entry.date).toLocaleDateString('de-DE')}
                                            </div>

                                            <div className="typo-card-title">
                                                {entry.km?.toLocaleString('de-DE')} KM
                                            </div>

                                            <div className="typo-body-dim">
                                                {formatNumber(entry.liters, 1)} L · {formatNumber(entry.price, 3)} {entry.currency || '€'}
                                            </div>
                                        </div>

                                        <div className="typo-value-normal text-[var(--accent)]">
                                            {formatNumber((entry.liters * entry.price) / (entry.exchangeRateToEur || 1), 2)} €
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {selectedArchive.fuelLog.length === 0 && (
                                <div className="typo-body-dim text-center py-8">
                                    Keine archivierten Tankeinträge
                                </div>
                            )}
                        </div>
                    )}

                    {archiveViewTab === 'trip' && (
                        <div className="space-y-3">
                            {selectedArchive.tripLog.map((entry: any) => (
                                <div key={entry.id} className="cg-master-card-small !p-3 border-l-2 !border-l-[var(--accent)] !mb-0">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="space-y-1">
                                            <div className="typo-body-dim">
                                                {new Date(entry.date).toLocaleDateString('de-DE')}
                                            </div>

                                            <div className="typo-card-title">
                                                {entry.destination}
                                            </div>

                                            {entry.purpose && (
                                                <div className="typo-body-dim">
                                                    {entry.purpose}
                                                </div>
                                            )}

                                            {entry.note && (
                                                <div className="typo-body-dim italic">
                                                    {entry.note}
                                                </div>
                                            )}
                                        </div>

                                        <div className="typo-value-normal text-[var(--accent)]">
                                            +{formatNumber((entry.toKm || 0) - (entry.fromKm || 0), 0)} KM
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {selectedArchive.tripLog.length === 0 && (
                                <div className="typo-body-dim text-center py-8">
                                    Keine archivierten Reisen
                                </div>
                            )}
                        </div>
                    )}

                    {archiveViewTab === 'business' && (
                        <div className="space-y-3">
                            {selectedArchive.businessTripLog.map((entry: any) => (
                                <div key={entry.id} className="cg-master-card-small !p-3 !mb-0">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-start gap-3">
                                            <div>
                                                <div className="typo-body-dim">
                                                    {new Date(entry.date).toLocaleDateString('de-DE')}
                                                </div>

                                                <div className="typo-card-title">
                                                    {entry.city ? `${entry.zip} ${entry.city}` : 'Fahrtenbuch'}
                                                </div>
                                            </div>

                                            <div className="typo-value-normal text-[var(--accent)]">
                                                +{formatNumber((entry.toKm || 0) - (entry.fromKm || 0), 0)} KM
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <span className="typo-body-dim">
                                                {entry.departureTime || '—'} → {entry.arrivalTime || '—'}
                                            </span>

                                            <span className="typo-body-dim">
                                                {entry.category}
                                            </span>
                                        </div>

                                        {entry.purpose && (
                                            <div className="typo-body-dim">
                                                {entry.purpose}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {selectedArchive.businessTripLog.length === 0 && (
                                <div className="typo-body-dim text-center py-8">
                                    Keine archivierten Fahrtenbuch-Einträge
                                </div>
                            )}
                        </div>
                    )}

                    {archiveViewTab === 'spots' && (
                        <div className="space-y-3">
                            {selectedArchive.spots.map((entry: any) => (
                                <div key={entry.id} className="cg-master-card-small !p-3 !mb-0">
                                    <div className="space-y-1">
                                        <div className="typo-body-dim">
                                            {new Date(entry.date).toLocaleDateString('de-DE')}
                                        </div>

                                        <div className="typo-card-title">
                                            {entry.name}
                                        </div>

                                        <div className="typo-body-dim">
                                            {entry.category}
                                        </div>

                                        <div className="typo-body-dim text-[var(--accent)]">
                                            {Number(entry.lat).toFixed(4)}, {Number(entry.lng).toFixed(4)}
                                        </div>

                                        {entry.note && (
                                            <div className="typo-body-dim italic">
                                                {entry.note}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {selectedArchive.spots.length === 0 && (
                                <div className="typo-body-dim text-center py-8">
                                    Keine archivierten POIs
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
  );
}
