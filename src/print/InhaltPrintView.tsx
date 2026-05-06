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
                totalWeightKg += getWeightInKg(item.weight, item.weightUnit);
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

    return (
        <div className="hidden print-only inhalt-print-wrapper bg-white">
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 10mm 20mm; }
                    .inhalt-print-wrapper {
                        display: block !important;
                        width: 100%;
                        color: black !important;
                    }
                    .print-category {
                        font-weight: bold;
                        font-size: 9pt !important;
                        margin-top: 5px;
                        margin-bottom: 0px;
                    }
                    .print-location {
                        font-weight: bold;
                        font-size: 7pt !important;
                        margin-top: 1px;
                        margin-bottom: 0px;
                        margin-left: 4mm;
                        color: #333;
                    }
                    .print-item-wrap {
                        display: flex;
                        flex-direction: column;
                        font-size: 7pt !important;
                        padding: 0;
                        margin-left: 8mm;
                        line-height: 1.4;
                    }
                    .print-item-line {
                        display: flex;
                        justify-content: space-between;
                        width: 100%;
                    }
                    .col-check { flex: 0 0 4mm; }
                    .col-name { flex: 1; padding-left: 2mm; }
                    .col-med-name { flex: 1 1 30%; padding-left: 2mm; }
                    .col-med-purpose { flex: 1 1 30%; padding-left: 2mm; }
                    .col-med-exp { flex: 0 0 22mm; padding-left: 2mm; }
                    .col-qty { flex: 0 0 18mm; text-align: right; }
                    .col-weight { flex: 0 0 16mm; text-align: right; }
                    .print-weight-sum {
                        margin-top: 8px;
                        font-size: 8pt !important;
                        font-weight: bold;
                        text-align: right;
                        padding-top: 2px;
                    }
                }
            `}</style>

            <PrintHeader title="Inventarliste" vehicleName={state.profile?.vehicleName} />

            {allCategories.map(category => {
                const subcats = Array.from(new Set(state.subcategories[category] || []));
                const itemsInCategory = state.inventory.filter((item: any) => item.category === category);
                
                if (itemsInCategory.length === 0) return null;

                return (
                    <div key={category}>
                        <div className="print-category">{category.toUpperCase()}</div>
                        {subcats.map((sub: any) => {
                            const itemsInSubcat = itemsInCategory.filter((item: any) => item.subcategory === sub);
                            if (itemsInSubcat.length === 0) return null;

                            return (
                                <div key={sub}>
                                    <div className="print-location">{sub}</div>
                                    {itemsInSubcat.map((item: any) => (
                                        <div className="print-item-wrap" key={item.id}>
                                            <div className="print-item-line">
                                                <div className="col-check">□</div>
                                                <div className="col-name">{item.name}</div>
                                                <div className="col-qty">{item.quantity} {formatUnit(item.unit)}</div>
                                                <div className="col-weight">
                                                    {item.weight !== undefined && item.weight !== null && item.weight !== '' 
                                                        ? `${item.weight} ${formatUnit(item.weightUnit || 'kg')}` 
                                                        : ''}
                                                </div>
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
                    <div className="print-category">Notfallausrüstung</div>
                    {Object.keys(groupedGear).map(loc => (
                        <div key={loc}>
                            <div className="print-location">{loc}</div>
                            {groupedGear[loc].map((g: any, _idx: number) => (
                                <div className="print-item-wrap" key={`${g.id}-${_idx}`}>
                                    <div className="print-item-line">
                                        <div className="col-check">□</div>
                                        <div className="col-name">{g.name}</div>
                                        <div className="col-qty">{g.printCount} Stk</div>
                                        <div className="col-weight">
                                            {g.weight !== undefined && g.weight !== null && g.weight !== ''
                                                ? `${g.weight} ${formatUnit(g.weightUnit || 'kg')}`
                                                : ''}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {pharmacyFilter.length > 0 && (
                <div>
                    <div className="print-category">Apotheke / Medikamente</div>
                    {Object.keys(groupedPharmacy).map(loc => (
                        <div key={loc}>
                            <div className="print-location">{loc}</div>
                            {groupedPharmacy[loc].map((p: any) => (
                                <div className="print-item-wrap" key={p.id}>
                                    <div className="print-item-line">
                                        <div className="col-check">□</div>
                                        <div className="col-med-name">{p.name}</div>
                                        <div className="col-med-purpose">{p.purpose}</div>
                                        <div className="col-med-exp">{p.expiry ? `Exp: ${p.expiry}` : ''}</div>
                                        <div className="col-qty">{p.quantity} {formatUnit(p.unit)}</div>
                                        <div className="col-weight">
                                            {p.weight !== undefined && p.weight !== null && p.weight !== ''
                                                ? `${p.weight} ${formatUnit(p.weightUnit || 'kg')}`
                                                : ''}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
            
            {totalWeightKg > 0 && (
                <div className="print-weight-sum">
                    Gesamtgewicht der gedruckten Liste: {totalWeightKg < 1 ? `${Math.round(totalWeightKg * 1000)} g / ` : ''}{totalWeightKg.toFixed(2)} kg
                </div>
            )}
        </div>
    );
}

