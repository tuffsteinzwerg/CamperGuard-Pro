import React from 'react';
import { Edit2 } from 'lucide-react';
import { formatNumber } from '../../lib/formatters';
import type { FuelEntry } from '../../types';

interface LogbuchTankListProps {
  currentFuelLog: FuelEntry[];
  setTankForm: (f: FuelEntry) => void;
  setEditingTripId: (id: string | null) => void;
  setIsAdding: (v: boolean) => void;
}

export function LogbuchTankList({
  currentFuelLog, setTankForm, setEditingTripId, setIsAdding
}: LogbuchTankListProps) {
  return (
          <div className="space-y-3">
            {currentFuelLog.map((entry: FuelEntry) => {
                const totalLocal = entry.price * entry.liters;
                const totalEur = totalLocal / (entry.exchangeRateToEur || 1);
                return (
                    <div key={entry.id} className="cg-master-card-small !p-3 flex justify-between items-center border-l-2 !border-l-[var(--accent)] !mb-0 gap-3">
                        <div className="flex-1 grid grid-cols-2 gap-y-1 items-center">
                            <div className="text-left flex items-center">
                                <span className="typo-body-dim">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                            </div>
                            <div className="text-right flex items-center justify-end">
                                <span className="typo-body-dim text-[var(--accent)]">{formatNumber(entry.liters, 1)} <span className="typo-label ml-0.5">L</span></span>
                            </div>
                            <div className="text-left flex items-center">
                                <span className="typo-value-normal">{formatNumber(entry.km, 0)} <span className="typo-label ml-0.5">KM</span></span>
                            </div>
                            <div className="text-right flex items-center justify-end">
                                <span className="typo-value-normal">{formatNumber(totalLocal, 2)} {entry.currency === 'EUR' ? '€' : entry.currency}</span>
                            </div>
                            <div className="text-left flex items-center">
                                <span className="typo-body-dim">{entry.fuelType}</span>
                            </div>
                            <div className="text-right flex items-center justify-end">
                                <span className="typo-body-dim">
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
            {currentFuelLog.length === 0 && (
                <div className="cg-master-card-small !p-6 !mb-0 text-center">
                    <div className="typo-value-large mb-2 opacity-30">⛽</div>
                    <div className="typo-card-title mb-1">Noch keine Tankungen</div>
                    <div className="typo-body-dim cg-master-muted">Tippe auf + um deine erste Tankung zu erfassen. CamperGuard Pro berechnet daraus deinen Verbrauch.</div>
                </div>
            )}
          </div>
  );
}
