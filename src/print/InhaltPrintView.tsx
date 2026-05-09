import React from 'react';
import { PrintHeader } from './PrintHeader';

export function InhaltPrintView({ state }: { state: any }) {
    const fixedCategories = ["Küche", "Wohnen", "Bad", "Garage", "Technik"];
    const otherCategories = Object.keys(state.subcategories || {}).filter(c => !fixedCategories.includes(c));
    const allCategories = [...fixedCategories, ...otherCategories];

    const formatUnit = (unit: string) => {
        if (!unit) return 'kg';
        const str = unit.trim().toLowerCase();
        if (str === 'grams' || str === 'gramm' || str === 'g') return 'g';
        return str;
    };

    const gearFilter = state.sos?.gear?.filter((g: any) => g.checked === true && Number(g.count) > 0 && g.isHidden !== true && g.isDeleted !== true) || [];
    const pharmacyFilter = state.sos?.pharmacy || [];

    const getWeightInKg = (weight: any, unit: any) => {
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
        const itemsInCategory = state.inventory.filter((item: any) => item.category === category);
        subcats.forEach((sub: any) => {
            const itemsInSubcat = itemsInCategory.filter((item: any) => item.subcategory === sub);
            itemsInSubcat.forEach((item: any) => {
                totalWeightKg += getWeightInKg(item.weight, item.weightUnit) * (item.quantity || 1);
            });
        });
    });

    gearFilter.forEach((g: any) => {
        totalWeightKg += getWeightInKg(g.weight, g.weightUnit);
    });

    pharmacyFilter.forEach((p: any) => {
        totalWeightKg += getWeightInKg(p.weight, p.weightUnit);
    });

    const normalizePrintGearName = (name: any): string => {
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
    gearFilter.forEach((g: any) => {
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
        if (typeof g.location === 'string') locsToMerge.push(g.location);
        
        locsToMerge.forEach(l => {
            const locStr = String(l).trim();
            if (locStr && !merged.locations.includes(locStr)) {
                merged.locations.push(locStr);
            }
        });
    });

    const printableGear = Object.values(printableGearMap);

    const groupedGear: Record<string, any[]> = {};
    printableGear.forEach((g: any) => {
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

    const groupedPharmacy = pharmacyFilter.reduce((acc: Record<string, any[]>, p: any) => {
        const loc = (p.location && p.location.trim()) ? p.location.trim() : 'Ohne Lagerort';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(p);
        return acc;
    }, {});

    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="hidden print-only inhalt-print-wrapper bg-white">
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 10mm 15mm; }
                    .inhalt-print-wrapper {
                        display: block !important;
                        width: 100%;
                        color: black !important;
                        font-family: sans-serif;
                    }
                    .inv-section-title {
                        font-size: 8pt;
                        font-weight: 700;
                        color: #FF6600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-top: 4mm;
                        margin-bottom: 1mm;
                        padding-bottom: 1mm;
                        border-bottom: 0.5pt solid #FF6600;
                    }
                    .inv-location-title {
                        font-size: 7pt;
                        font-weight: 600;
                        color: #555;
                        margin-top: 2mm;
                        margin-bottom: 0.5mm;
                        padding-left: 1mm;
                    }
                    .inv-col-header {
                        display: grid;
                        grid-template-columns: 5% 55% 20% 20%;
                        align-items: center;
                        min-height: 5mm;
                        padding: 0 0 1mm 0;
                        border-bottom: 0.5pt solid #999;
                        font-size: 6pt;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                        color: #888;
                        font-weight: 700;
                        margin-top: 1mm;
                    }
                    .inv-row {
                        display: grid;
                        grid-template-columns: 5% 55% 20% 20%;
                        align-items: center;
                        min-height: 4.5mm;
                        padding: 0.6mm 0;
                        border-bottom: 0.2pt solid #e0e0e0;
                        font-size: 7pt;
                        color: #222;
                        page-break-inside: avoid;
                    }
                    .inv-row .inv-check { text-align: center; font-size: 7pt; color: #ccc; }
                    .inv-row .inv-name { text-align: left; padding-left: 1mm; }
                    .inv-row .inv-qty { text-align: right; color: #555; }
                    .inv-row .inv-weight { text-align: right; color: #555; }
                    .inv-med-col-header {
                        display: grid;
                        grid-template-columns: 5% 25% 22% 16% 16% 16%;
                        align-items: center;
                        min-height: 5mm;
                        padding: 0 0 1mm 0;
                        border-bottom: 0.5pt solid #999;
                        font-size: 6pt;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                        color: #888;
                        font-weight: 700;
                        margin-top: 1mm;
                    }
                    .inv-med-row {
                        display: grid;
                        grid-template-columns: 5% 25% 22% 16% 16% 16%;
                        align-items: center;
                        min-height: 4.5mm;
                        padding: 0.6mm 0;
                        border-bottom: 0.2pt solid #e0e0e0;
                        font-size: 7pt;
                        color: #222;
                        page-break-inside: avoid;
                    }
                    .inv-med-row .inv-check { text-align: center; font-size: 7pt; color: #ccc; }
                    .inv-med-row .inv-name { text-align: left; padding-left: 1mm; }
                    .inv-med-row .inv-purpose { text-align: left; color: #555; }
                    .inv-med-row .inv-expiry { text-align: center; color: #555; }
                    .inv-med-row .inv-qty { text-align: right; color: #555; }
                    .inv-med-row .inv-weight { text-align: right; color: #555; }
                    .inv-weight-footer {
                        position: fixed;
                        bottom: 10mm;
                        left: 0;
                        right: 0;
                        padding: 2mm 0 0 0;
                        margin: 0;
                        border-top: 0.5pt solid #cfcfcf;
                        background: white;
                        z-index: 50;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        font-family: sans-serif;
                    }
                    .inv-weight-footer-label {
                        font-size: 7pt;
                        color: #888;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .inv-weight-footer-value {
                        font-size: 9pt;
                        color: #111;
                        font-weight: 700;
                        margin-top: 1px;
                    }
                    .inv-article-count {
                        text-align: right;
                    }
                }
            `}</style>

            <PrintHeader 
                title="Inventarliste" 
                vehicleName={state.profile?.vehicleName} 
                plate={state.profile?.plate}
                createdDate={today}
            />

            {allCategories.map(category => {
                const subcats = Array.from(new Set(state.subcategories[category] || []));
                const itemsInCategory = state.inventory.filter((item: any) => item.category === category);
                
                if (itemsInCategory.length === 0) return null;

                return (
                    <div key={category}>
                        <div className="inv-section-title"><span style={{marginRight: '3px', fontSize: '8pt'}}>📦</span> {category.toUpperCase()}</div>
                        
                        <div className="inv-col-header">
                            <div style={{textAlign: 'center'}}>✓</div>
                            <div style={{textAlign: 'left', paddingLeft: '1mm'}}>Artikel</div>
                            <div style={{textAlign: 'right'}}>Menge</div>
                            <div style={{textAlign: 'right'}}>Gewicht</div>
                        </div>

                        {subcats.map((sub: any) => {
                            const itemsInSubcat = itemsInCategory.filter((item: any) => item.subcategory === sub);
                            if (itemsInSubcat.length === 0) return null;

                            return (
                                <div key={sub}>
                                    <div className="inv-location-title">📍 {sub}</div>
                                    {itemsInSubcat.map((item: any) => (
                                        <div className="inv-row" key={item.id}>
                                            <div className="inv-check">□</div>
                                            <div className="inv-name">{item.name}</div>
                                            <div className="inv-qty">{item.quantity} {formatUnit(item.unit)}</div>
                                            <div className="inv-weight">
                                                {item.weight !== undefined && item.weight !== null && item.weight !== '' 
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
                    <div className="inv-section-title"><span style={{marginRight: '3px', fontSize: '8pt'}}>🛡️</span> Notfallausrüstung</div>
                    
                    <div className="inv-col-header">
                        <div style={{textAlign: 'center'}}>✓</div>
                        <div style={{textAlign: 'left', paddingLeft: '1mm'}}>Ausrüstung</div>
                        <div style={{textAlign: 'right'}}>Menge</div>
                        <div style={{textAlign: 'right'}}>Gewicht</div>
                    </div>

                    {Object.keys(groupedGear).map(loc => (
                        <div key={loc}>
                            <div className="inv-location-title">📍 {loc}</div>
                            {groupedGear[loc].map((g: any, _idx: number) => (
                                <div className="inv-row" key={`${g.id}-${_idx}`}>
                                    <div className="inv-check">□</div>
                                    <div className="inv-name">{g.name}</div>
                                    <div className="inv-qty">{g.printCount} Stk</div>
                                    <div className="inv-weight">
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
                    <div className="inv-section-title"><span style={{marginRight: '3px', fontSize: '8pt'}}>💊</span> Apotheke / Medikamente</div>
                    
                    <div className="inv-med-col-header">
                        <div style={{textAlign: 'center'}}>✓</div>
                        <div style={{textAlign: 'left', paddingLeft: '1mm'}}>Medikament</div>
                        <div style={{textAlign: 'left'}}>Zweck</div>
                        <div style={{textAlign: 'center'}}>Ablaufdatum</div>
                        <div style={{textAlign: 'right'}}>Menge</div>
                        <div style={{textAlign: 'right'}}>Gewicht</div>
                    </div>

                    {Object.keys(groupedPharmacy).map(loc => (
                        <div key={loc}>
                            <div className="inv-location-title">📍 {loc}</div>
                            {groupedPharmacy[loc].map((p: any) => (
                                <div className="inv-med-row" key={p.id}>
                                    <div className="inv-check">□</div>
                                    <div className="inv-name">{p.name}</div>
                                    <div className="inv-purpose">{p.purpose}</div>
                                    <div className="inv-expiry">{p.expiry || ''}</div>
                                    <div className="inv-qty">{p.quantity} {formatUnit(p.unit)}</div>
                                    <div className="inv-weight">
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
                <div className="inv-weight-footer">
                    <div>
                        <div className="inv-weight-footer-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>⚖️</span> Gesamtgewicht</div>
                        <div className="inv-weight-footer-value">
                            {totalWeightKg < 1 ? `${Math.round(totalWeightKg * 1000)} g` : `${totalWeightKg.toFixed(2)} kg`}
                        </div>
                    </div>
                    <div className="inv-article-count">
                        <div className="inv-weight-footer-label"><span style={{marginRight: '3px', fontSize: '8pt'}}>📋</span> Artikel gesamt</div>
                        <div className="inv-weight-footer-value">
                            {state.inventory.length + printableGear.length + pharmacyFilter.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
