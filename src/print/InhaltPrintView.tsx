import React from 'react';

export function InhaltPrintView({ state }: { state: any }) {
    const fixedCategories = ["Küche", "Wohnen", "Bad", "Garage", "Technik"];
    const otherCategories = Object.keys(state.subcategories || {}).filter(c => !fixedCategories.includes(c));
    const allCategories = [...fixedCategories, ...otherCategories];

    const formatUnit = (u?: string) => {
        if (!u) return '';
        const lower = u.toLowerCase();
        if (lower === 'g' || lower === 'gr') return 'g';
        if (lower === 'stk' || lower === 'stück') return 'stk';
        if (lower === 'kg') return 'kg';
        if (lower === 'l' || lower === 'liter') return 'l';
        return u;
    };

    const gearFilter = (state.sos?.gear || []).filter((g: any) => 
        g.checked === true && Number(g.count) > 0 && g.isHidden !== true && g.isDeleted !== true
    );
    const pharmacyFilter = state.sos?.pharmacy || [];

    return (
        <div className="hidden print-only inhalt-print-wrapper bg-white">
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 4mm 5mm; }
                    .inhalt-print-wrapper {
                        display: block !important;
                        width: 100%;
                        color: black !important;
                        font-family: sans-serif;
                        padding-bottom: 0;
                        line-height: 1.12;
                    }
                    .inhalt-print-wrapper * {
                        color: black !important;
                    }
                    .print-header-line {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        border-bottom: 1px solid black;
                        padding-bottom: 1px;
                        margin-bottom: 4px;
                        font-size: 8pt !important;
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    .print-header-left {
                        font-size: 8pt !important;
                        font-weight: 900;
                        letter-spacing: 1px;
                    }
                    .print-header-right {
                        display: flex;
                        gap: 12px;
                    }
                    .print-category {
                        font-size: 7.8pt !important;
                        font-weight: bold;
                        text-transform: uppercase;
                        margin-top: 4px;
                        margin-bottom: 1px;
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                    .print-location { 
                        font-size: 7.4pt !important; 
                        font-weight: bold;
                        page-break-after: avoid;
                        break-after: avoid;
                        margin-top: 2px;
                        margin-bottom: 1px;
                        margin-left: 6px;
                    }
                    .print-item-wrap {
                        font-size: 6.8pt !important;
                        margin-left: 10px;
                        display: flex;
                        flex-direction: column;
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 1px;
                    }
                    .print-item-line {
                        display: flex;
                        width: 100%;
                        gap: 4px;
                    }
                    .col-check { width: 4mm; text-align: left; flex-shrink: 0; }
                    .col-name { flex: 1; }
                    .col-qty { width: 18mm; text-align: right; flex-shrink: 0; }
                    .col-weight { width: 16mm; text-align: right; flex-shrink: 0; }
                    .print-footer { 
                        margin-top: 2px;
                        padding-top: 1px;
                        border-top: 1px solid #ccc;
                        display: flex;
                        justify-content: space-between;
                        font-size: 6pt !important; 
                    }
                }
            `}</style>

            <div className="print-header-line">
                <div className="print-header-left">INHALT</div>
                <div className="print-header-right">
                    <span>{state.profile?.vehicleName || "Camper"}</span>
                    <span>{state.profile?.plate || "Kennzeichen"}</span>
                </div>
            </div>

            {allCategories.map(category => {
                const subcats = Array.from(new Set(state.subcategories[category] || []));
                const itemsInCategory = state.inventory.filter((item: any) => item.category === category);
                
                if (subcats.length === 0 && itemsInCategory.length === 0) {
                    return null;
                }

                let hasRenderedSubcats = false;

                const categoryContent = subcats.map((sub: any) => {
                    const itemsInSubcat = itemsInCategory.filter((item: any) => item.subcategory === sub);
                    
                    if (itemsInSubcat.length === 0) return null;
                    
                    hasRenderedSubcats = true;

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
                                            {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) 
                                                ? `${item.weight} ${formatUnit(item.weightUnit || 'kg')}`
                                                : ''}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                });

                if (!hasRenderedSubcats) return null;

                return (
                    <div key={category}>
                        <div className="print-category">{category}</div>
                        {categoryContent}
                    </div>
                );
            })}

            {gearFilter.length > 0 && (
                <div>
                    <div className="print-category">Notfallausrüstung</div>
                    {gearFilter.map((g: any) => {
                        const locString = (g.locations || []).filter((l: string) => l.trim() !== '').join(', ');
                        return (
                            <div className="print-item-wrap" key={g.id}>
                                <div className="print-item-line">
                                    <div className="col-check">□</div>
                                    <div className="col-name">
                                        {g.name}
                                        {locString && <span style={{color: '#555'}}> ({locString})</span>}
                                    </div>
                                    <div className="col-qty">{g.count} Stk</div>
                                    <div className="col-weight">
                                        {g.weight !== undefined && g.weight !== null && g.weight !== ''
                                            ? `${g.weight} ${formatUnit(g.weightUnit || 'kg')}`
                                            : ''}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {pharmacyFilter.length > 0 && (
                <div>
                    <div className="print-category">Apotheke / Medikamente</div>
                    {pharmacyFilter.map((p: any) => {
                        const subLinePieces = [p.purpose, p.location, p.expiry ? `Exp: ${p.expiry}` : null].filter(Boolean);
                        return (
                            <div className="print-item-wrap" key={p.id}>
                                <div className="print-item-line">
                                    <div className="col-check">□</div>
                                    <div className="col-name">{p.name}</div>
                                    <div className="col-qty">{p.quantity} {formatUnit(p.unit)}</div>
                                    <div className="col-weight">
                                        {p.weight !== undefined && p.weight !== null && p.weight !== ''
                                            ? `${p.weight} ${formatUnit(p.weightUnit || 'kg')}`
                                            : ''}
                                    </div>
                                </div>
                                {subLinePieces.length > 0 && (
                                    <div className="print-item-line" style={{ color: '#555', marginTop: '1px' }}>
                                        <div className="col-check"></div>
                                        <div className="col-name">{subLinePieces.join(' | ')}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            
            <div className="print-footer">
                <span>CamperGuard Pro</span>
                <span>Gedruckt am: {new Date().toLocaleDateString('de-DE')}</span>
            </div>
        </div>
    );
}
