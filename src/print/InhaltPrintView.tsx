import React from 'react';

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

    const groupedGear: Record<string, any[]> = {};
    gearFilter.forEach((g: any) => {
        let locs: string[] = [];
        if (g.locations && Array.isArray(g.locations)) {
            locs = g.locations.map((l: string) => l.trim()).filter(Boolean);
        } else if (g.location && typeof g.location === 'string' && g.location.trim() !== '') {
            locs = [g.location.trim()];
        }
        
        if (locs.length === 0) {
            locs = ['Ohne Lagerort'];
        }

        locs.forEach(loc => {
            if (!groupedGear[loc]) groupedGear[loc] = [];
            groupedGear[loc].push(g);
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
                    @page { size: A4 portrait; margin: 15mm 20mm; }
                    .inhalt-print-wrapper {
                        display: block !important;
                        width: 100%;
                        color: black !important;
                    }
                    .print-category {
                        font-weight: bold;
                        font-size: 11pt !important;
                        margin-top: 15px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 2px;
                    }
                    .print-location {
                        font-weight: bold;
                        font-size: 9pt !important;
                        margin-top: 8px;
                        color: #333;
                    }
                    .print-item-wrap {
                        display: flex;
                        flex-direction: column;
                        font-size: 8pt !important;
                        border-bottom: 1px solid #eee;
                        padding: 3px 0;
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
                    .print-footer { 
                        margin-top: 4mm;
                        padding-top: 2mm;
                        border-top: 1px solid #000;
                        display: flex;
                        align-items: center;
                        justify-content: flex-start;
                        break-inside: avoid;
                        page-break-inside: avoid;
                        font-size: 7pt !important; 
                    }
                    .print-weight-sum {
                        margin-top: 12px;
                        font-size: 8pt !important;
                        font-weight: bold;
                        text-align: right;
                        border-top: 1px solid #000;
                        padding-top: 4px;
                    }
                    .print-footer-logo {
                        height: 32mm;
                        width: auto;
                        display: block;
                    }
                }
            `}</style>

            <div className="print-header-line" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #000', paddingBottom: '4px', fontWeight: 'bold', fontSize: '10pt' }}>
                <div>INHALT</div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <span>{state.profile?.vehicleName || "Camper"}</span>
                    <span>{state.profile?.plate || "Kennzeichen"}</span>
                    <span>Gedruckt am: {new Date().toLocaleDateString('de-DE')}</span>
                </div>
            </div>

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

            {gearFilter.length > 0 && (
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
                                        <div className="col-qty">{g.count} Stk</div>
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

            <div className="print-footer">
                <img src="/CGProLogo.png" alt="CamperGuard Pro" className="print-footer-logo" />
            </div>
        </div>
    );
}
