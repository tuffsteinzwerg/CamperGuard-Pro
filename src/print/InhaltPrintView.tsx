import React from 'react';
import type { AppState, InventoryItem, EmergencyGear, PharmacyItem } from '../types';
import { PrintHeader } from './PrintHeader';

export function InhaltPrintView({ state }: { state: AppState }) {
    const fixedCategories = ["Küche", "Wohnen", "Bad", "Garage", "Technik"];
    const otherCategories = Object.keys(state.subcategories || {}).filter(c => !fixedCategories.includes(c));
    const allCategories = [...fixedCategories, ...otherCategories];

    const formatUnit = (unit: string) => {
        if (!unit) return 'kg';
        const str = unit.trim().toLowerCase();
        if (str === 'grams' || str === 'gramm' || str === 'g') return 'g';
        return str;
    };

    const gearFilter = state.sos?.gear?.filter((g: EmergencyGear) => g.checked === true && Number(g.count) > 0 && g.isHidden !== true && g.isDeleted !== true) || [];
    const pharmacyFilter = state.sos?.pharmacy || [];

    const getWeightInKg = (weight: number | string | undefined | null, unit: string | undefined) => {
        if (weight === undefined || weight === null || weight === '') return 0;
        const num = Number(weight);
        if (isNaN(num)) return 0;
        const u = formatUnit(unit);
        if (u === 'g') return num / 1000;
        return num;
    };

    let totalWeightKg = 0;

    allCategories.forEach(category => {
        const subcats = Array.from(new Set(state.subcategories[category] || []));
        const itemsInCategory = state.inventory.filter((item: InventoryItem) => item.category === category);
        subcats.forEach((sub: string) => {
            const itemsInSubcat = itemsInCategory.filter((item: InventoryItem) => item.subcategory === sub);
            itemsInSubcat.forEach((item: InventoryItem) => {
                totalWeightKg += getWeightInKg(item.weight, item.weightUnit) * (item.quantity || 1);
            });
        });
    });

    gearFilter.forEach((g: EmergencyGear) => {
        totalWeightKg += getWeightInKg(g.weight, g.weightUnit);
    });

    pharmacyFilter.forEach((p: PharmacyItem) => {
        totalWeightKg += getWeightInKg(p.weight, p.weightUnit);
    });

    const normalizePrintGearName = (name: string | undefined | null): string => {
        const str = String(name || '').trim();
        const lower = str.toLowerCase();
        const cleaned = lower.replace(/[\s\-\(\)\[\]\{\}_.,!?"']/g, '');
        if (cleaned.includes('warnweste') || cleaned.includes('warnwesten')) return 'Warnweste';
        if (cleaned.includes('feuerlöscher') || cleaned.includes('feuerlscher')) return 'Feuerlöscher';
        if (cleaned.includes('feuerlöschdecke') || cleaned.includes('feuerlschdecke')) return 'Feuerlöschdecke';
        if (cleaned.includes('erstehilfekasten') || cleaned.includes('verbandskasten') || cleaned.includes('verbandkasten')) return 'Erste-Hilfe-Kasten';
        if (cleaned.includes('warndreieck')) return 'Warndreieck';
        return str;
    };

    const printableGearMap: Record<string, any> = {};
    gearFilter.forEach((g: EmergencyGear) => {
        const normName = normalizePrintGearName(g.name);
        if (!printableGearMap[normName]) {
            printableGearMap[normName] = {
                ...g,
                name: normName,
                locations: [],
                count: Number(g.count) || 0
            };
        } else {
            const merged = printableGearMap[normName];
            if (g.checked) merged.checked = true;
            const c = Number(g.count) || 0;
            if (c > merged.count) merged.count = c;
            
            if (merged.weight === undefined || merged.weight === null || merged.weight === '') {
                if (g.weight !== undefined && g.weight !== null && g.weight !== '') {
                    merged.weight = g.weight;
                    merged.weightUnit = g.weightUnit;
                }
            }
        }
        
        const merged = printableGearMap[normName];
        let locsToMerge: string[] = [];
        if (g.locations && Array.isArray(g.locations)) locsToMerge.push(...g.locations);
        if (typeof g.locations === 'string') locsToMerge.push(g.locations);
        
        locsToMerge.forEach(l => {
            const locStr = String(l).trim();
            if (locStr && !merged.locations.includes(locStr)) {
                merged.locations.push(locStr);
            }
        });
    });

    const printableGear = Object.values(printableGearMap);

    const groupedGear: Record<string, any[]> = {};
    printableGear.forEach((g: EmergencyGear) => {
        let locs: string[] = g.locations && Array.isArray(g.locations) ? [...g.locations] : [];
        if (locs.length === 0) {
            locs = ['Ohne Lagerort'];
        }

        const locCount = locs.length;
        const totalCount = Number(g.count) || 0;
        let baseCount = totalCount;
        let remainder = 0;
        
        if (locCount > 0 && totalCount >= locCount) {
            baseCount = Math.floor(totalCount / locCount);
            remainder = totalCount % locCount;
        } else if (locCount > 0 && totalCount < locCount) {
            baseCount = 0;
            remainder = totalCount;
        }

        locs.forEach(loc => {
            let currentCount = baseCount;
            if (remainder > 0) {
                currentCount++;
                remainder--;
            }
            if (currentCount > 0) {
                if (!groupedGear[loc]) groupedGear[loc] = [];
                groupedGear[loc].push({
                    ...g,
                    printCount: currentCount
                });
            }
        });
    });

    const groupedPharmacy = pharmacyFilter.reduce((acc: Record<string, any[]>, p: PharmacyItem) => {
        const loc = (p.location && p.location.trim()) ? p.location.trim() : 'Ohne Lagerort';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(p);
        return acc;
    }, {});

    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="hidden print-only inhalt-print-wrapper bg-white">

            <PrintHeader 
                title="Inventarliste" 
                vehicleName={state.profile?.vehicleName} 
                plate={state.profile?.plate}
                createdDate={today}
            />

            {allCategories.map(category => {
                const subcats = Array.from(new Set(state.subcategories[category] || []));
                const itemsInCategory = state.inventory.filter((item: InventoryItem) => item.category === category);
                
                if (itemsInCategory.length === 0) return null;

                return (
                    <div key={category}>
                        <div className="cg-print-section-title"><span className="cg-print-icon-sm">📦</span> {category.toUpperCase()}</div>
                        
                        <div className="inv-col-header cg-print-col-header">
                            <div className="cg-print-align-center">✓</div>
                            <div className="cg-print-align-left-pad">Artikel</div>
                            <div className="cg-print-align-right">Menge</div>
                            <div className="cg-print-align-right">Gewicht</div>
                        </div>

                        {subcats.map((sub: string) => {
                            const itemsInSubcat = itemsInCategory.filter((item: InventoryItem) => item.subcategory === sub);
                            if (itemsInSubcat.length === 0) return null;

                            return (
                                <div key={sub}>
                                    <div className="cg-print-location-title">📍 {sub}</div>
                                    {itemsInSubcat.map((item: InventoryItem) => (
                                        <div className="inv-row cg-print-row" key={item.id}>
                                            <div className="cg-print-cell-check">□</div>
                                            <div className="cg-print-cell-name">{item.name}</div>
                                            <div className="cg-print-cell-num">{item.quantity} {formatUnit(item.unit)}</div>
                                            <div className="cg-print-cell-num">
                                                {item.weight !== undefined && item.weight !== null 
                                                    ? `${item.weight} ${formatUnit(item.weightUnit || 'kg')}` 
                                                    : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                );
            })}

            {Object.keys(groupedGear).length > 0 && (
                <div>
                    <div className="cg-print-section-title"><span className="cg-print-icon-sm">🛡️</span> Notfallausrüstung</div>
                    
                    <div className="inv-col-header cg-print-col-header">
                        <div className="cg-print-align-center">✓</div>
                        <div className="cg-print-align-left-pad">Ausrüstung</div>
                        <div className="cg-print-align-right">Menge</div>
                        <div className="cg-print-align-right">Gewicht</div>
                    </div>

                    {Object.keys(groupedGear).map(loc => (
                        <div key={loc}>
                            <div className="cg-print-location-title">📍 {loc}</div>
                            {groupedGear[loc].map((g: EmergencyGear, _idx: number) => (
                                <div className="inv-row cg-print-row" key={`${g.id}-${_idx}`}>
                                    <div className="cg-print-cell-check">□</div>
                                    <div className="cg-print-cell-name">{g.name}</div>
                                    <div className="cg-print-cell-num">{(g as any).printCount || g.count} Stk</div>
                                    <div className="cg-print-cell-num">
                                        {g.weight !== undefined && g.weight !== null && g.weight !== ''
                                            ? `${g.weight} ${formatUnit(g.weightUnit || 'kg')}`
                                            : ''}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {pharmacyFilter.length > 0 && (
                <div>
                    <div className="cg-print-section-title"><span className="cg-print-icon-sm">💊</span> Apotheke / Medikamente</div>
                    
                    <div className="inv-med-col-header cg-print-col-header">
                        <div className="cg-print-align-center">✓</div>
                        <div className="cg-print-align-left-pad">Medikament</div>
                        <div className="cg-print-align-left">Zweck</div>
                        <div className="cg-print-align-center">Ablaufdatum</div>
                        <div className="cg-print-align-right">Menge</div>
                        <div className="cg-print-align-right">Gewicht</div>
                    </div>

                    {Object.keys(groupedPharmacy).map(loc => (
                        <div key={loc}>
                            <div className="cg-print-location-title">📍 {loc}</div>
                            {groupedPharmacy[loc].map((p: PharmacyItem) => (
                                <div className="inv-med-row cg-print-row" key={p.id}>
                                    <div className="cg-print-cell-check">□</div>
                                    <div className="cg-print-cell-name">{p.name}</div>
                                    <div className="cg-print-cell-muted">{p.purpose}</div>
                                    <div className="cg-print-cell-muted">{p.expiry || ''}</div>
                                    <div className="cg-print-cell-num">{p.quantity} {formatUnit(p.unit)}</div>
                                    <div className="cg-print-cell-num">
                                        {p.weight !== undefined && p.weight !== null && p.weight !== ''
                                            ? `${p.weight} ${formatUnit(p.weightUnit || 'kg')}`
                                            : ''}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
            
            {totalWeightKg > 0 && (
                <div className="inv-weight-footer cg-print-summary-wrapper">
                    <div>
                        <div className="cg-print-summary-label"><span className="cg-print-icon-sm">⚖️</span> Gesamtgewicht</div>
                        <div className="cg-print-summary-value">
                            {totalWeightKg < 1 ? `${Math.round(totalWeightKg * 1000)} g` : `${totalWeightKg.toFixed(2)} kg`}
                        </div>
                    </div>
                    <div className="inv-article-count">
                        <div className="cg-print-summary-label"><span className="cg-print-icon-sm">📋</span> Artikel gesamt</div>
                        <div className="cg-print-summary-value">
                            {state.inventory.length + printableGear.length + pharmacyFilter.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
