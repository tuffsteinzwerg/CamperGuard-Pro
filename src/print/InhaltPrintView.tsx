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
                    @page { size: A4 portrait; margin: 8mm; }
                    .inhalt-print-wrapper {
                        display: block !important;
                        width: 100%;
                        color: black !important;
                        font-family: sans-serif;
                        line-height: 1.2;
                    }
                    .inhalt-print-wrapper * {
                        color: black !important;
                    }
                    .print-header-line {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        border-bottom: 2px solid black;
                        padding-bottom: 2px;
                        margin-bottom: 6px;
                        font-size: 9pt !important;
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    .print-header-left {
                        font-size: 11pt !important;
                        font-weight: 900;
                        letter-spacing: 1px;
                    }
                    .print-header-right {
                        display: flex;
                        gap: 16px;
                    }
                    .print-category {
                        font-size: 8.5pt !important;
                        font-weight: bold;
                        text-transform: uppercase;
                        margin-top: 8px;
                        margin-bottom: 2px;
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                    .print-location { 
                        font-size: 8pt !important; 
                        font-weight: bold;
                        page-break-after: avoid;
                        break-after: avoid;
                        margin-top: 4px;
                        margin-bottom: 2px;
                        margin-left: 8px;
                    }
                    .print-item-row {
                        font-size: 7.5pt !important;
                        margin-left: 16px;
                        display: flex;
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 1px;
                    }
                    .print-item-row > div {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .print-footer { 
                        margin-top: 6px;
                        padding-top: 2px;
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
                                <div className="print-item-row" key={item.id}>
                                    <div style={{ width: '12px' }}>□</div>
                                    <div style={{ flex: '1' }}>{item.name}</div>
                                    <div style={{ width: '60px', textAlign: 'right' }}>{item.quantity} {formatUnit(item.unit)}</div>
                                    <div style={{ width: '60px', textAlign: 'right' }}>
                                        {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) 
                                            ? `${item.weight} ${formatUnit(item.weightUnit || 'kg')}`
                                            : ''}
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
                    {gearFilter.map((g: any) => (
                        <div className="print-item-row" key={g.id}>
                            <div style={{ width: '12px' }}>□</div>
                            <div style={{ flex: '1' }}>{g.name}</div>
                            <div style={{ width: '50px', textAlign: 'right' }}>{g.count} Stk</div>
                            <div style={{ width: '100px', textAlign: 'right', paddingLeft: '8px' }}>
                                {(g.locations || []).filter((l: string) => l.trim() !== '').join(', ')}
                            </div>
                            <div style={{ width: '60px', textAlign: 'right' }}>
                                {g.weight !== undefined && g.weight !== null && g.weight !== ''
                                    ? `${g.weight} ${formatUnit(g.weightUnit || 'kg')}`
                                    : ''}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {pharmacyFilter.length > 0 && (
                <div>
                    <div className="print-category">Apotheke / Medikamente</div>
                    {pharmacyFilter.map((p: any) => (
                        <div className="print-item-row" key={p.id}>
                            <div style={{ width: '12px' }}>□</div>
                            <div style={{ flex: '1' }}>
                                {p.name} {p.purpose && <span style={{ color: '#555' }}> - {p.purpose}</span>}
                            </div>
                            <div style={{ width: '50px', textAlign: 'right' }}>{p.quantity} {formatUnit(p.unit)}</div>
                            <div style={{ width: '80px', textAlign: 'right', paddingLeft: '8px' }}>{p.location}</div>
                            <div style={{ width: '50px', textAlign: 'right' }}>{p.expiry}</div>
                            <div style={{ width: '60px', textAlign: 'right' }}>
                                {p.weight !== undefined && p.weight !== null && p.weight !== ''
                                    ? `${p.weight} ${formatUnit(p.weightUnit || 'kg')}`
                                    : ''}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            <div className="print-footer">
                <span>CamperGuard Pro</span>
                <span>Gedruckt am: {new Date().toLocaleDateString('de-DE')}</span>
            </div>
        </div>
    );
}
