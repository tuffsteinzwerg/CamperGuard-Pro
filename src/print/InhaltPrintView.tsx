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
                        padding-bottom: 8mm;
                    }
                    .inhalt-print-wrapper h1,
                    .inhalt-print-wrapper h2,
                    .inhalt-print-wrapper h3,
                    .inhalt-print-wrapper h4,
                    .inhalt-print-wrapper p,
                    .inhalt-print-wrapper div,
                    .inhalt-print-wrapper span,
                    .inhalt-print-wrapper td,
                    .inhalt-print-wrapper th {
                        color: black !important;
                    }
                    .inhalt-print-title { font-size: 11pt !important; }
                    .inhalt-print-meta { font-size: 8pt !important; color: #555 !important; }
                    
                    .inhalt-print-section-wrap { page-break-inside: auto; }
                    .inhalt-print-section {
                        font-size: 9.5pt !important; 
                        page-break-after: avoid;
                        break-after: avoid;
                        margin-top: 12px;
                        margin-bottom: 4px;
                        border-bottom: 1px solid #000 !important;
                        padding-bottom: 2px !important;
                    }
                    
                    .inhalt-print-location { 
                        font-size: 8.5pt !important; 
                        page-break-after: avoid;
                        break-after: avoid;
                        margin-top: 6px;
                        margin-bottom: 2px;
                        margin-left: 6px;
                    }
                    
                    .inhalt-print-table { 
                        width: calc(100% - 6px); 
                        margin-left: 6px;
                        border-collapse: collapse; 
                        margin-bottom: 8px; 
                    }
                    .inhalt-print-table th, .inhalt-print-table td {
                        font-size: 8pt !important;
                    }
                    .inhalt-print-table th { 
                        background: transparent !important; 
                        font-weight: bold; 
                        padding: 2px 3px; 
                        border-bottom: 1px solid #000 !important; 
                        text-align: left; 
                    }
                    .inhalt-print-table td { 
                        padding: 2px 3px; 
                        border-bottom: 1px solid #eee !important; 
                        vertical-align: top; 
                    }
                    .inhalt-print-table tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .print-checkbox-col {
                        width: 5mm;
                        text-align: center !important;
                    }
                    
                    .inhalt-print-footer, .inhalt-print-footer span { 
                        font-size: 7pt !important; 
                    }
                }
            `}</style>
            <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-4">
                <div>
                    <h1 className="inhalt-print-title font-black uppercase tracking-widest">{state.profile?.vehicleName || "Camper"}</h1>
                    <p className="inhalt-print-meta font-bold uppercase">{state.profile?.plate || "Kennzeichen"}</p>
                </div>
                <h2 className="inhalt-print-title font-black uppercase">Inhaltsliste</h2>
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
                        <div key={sub} className="mb-2">
                            <h4 className="inhalt-print-location font-bold uppercase border-b border-gray-300 pb-1">{sub}</h4>
                            <table className="inhalt-print-table text-left">
                                <thead>
                                    <tr>
                                        <th className="print-checkbox-col">✓</th>
                                        <th>Artikel</th>
                                        <th className="w-20">Menge</th>
                                        <th className="w-20">Gewicht</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsInSubcat.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="print-checkbox-col">□</td>
                                            <td>{item.name}</td>
                                            <td>{item.quantity} {formatUnit(item.unit)}</td>
                                            <td>
                                                {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) 
                                                    ? `${item.weight} ${formatUnit(item.weightUnit || 'kg')}`
                                                    : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                });

                if (!hasRenderedSubcats) return null;

                return (
                    <div key={category} className="inhalt-print-section-wrap mb-4">
                        <h3 className="inhalt-print-section font-black uppercase">{category}</h3>
                        {categoryContent}
                    </div>
                );
            })}

            {gearFilter.length > 0 && (
                <div className="inhalt-print-section-wrap mb-4">
                    <h3 className="inhalt-print-section font-black uppercase">Notfallausrüstung</h3>
                    <table className="inhalt-print-table text-left">
                        <thead>
                            <tr>
                                <th className="print-checkbox-col">✓</th>
                                <th>Artikel</th>
                                <th className="w-20">Menge</th>
                                <th className="w-32">Lagerorte</th>
                                <th className="w-20">Gewicht</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gearFilter.map((g: any) => (
                                <tr key={g.id}>
                                    <td className="print-checkbox-col">□</td>
                                    <td>{g.name}</td>
                                    <td>{g.count} Stk</td>
                                    <td>{(g.locations || []).filter((l: string) => l.trim() !== '').join(', ')}</td>
                                    <td>
                                        {g.weight !== undefined && g.weight !== null && g.weight !== ''
                                            ? `${g.weight} ${formatUnit(g.weightUnit || 'kg')}`
                                            : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {pharmacyFilter.length > 0 && (
                <div className="inhalt-print-section-wrap mb-4">
                    <h3 className="inhalt-print-section font-black uppercase">Apotheke / Medikamente</h3>
                    <table className="inhalt-print-table text-left">
                        <thead>
                            <tr>
                                <th className="print-checkbox-col">✓</th>
                                <th>Medikament</th>
                                <th>Zweck</th>
                                <th className="w-20">Menge</th>
                                <th>Lagerort</th>
                                <th className="w-20">Exp.</th>
                                <th className="w-20">Gewicht</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pharmacyFilter.map((p: any) => (
                                <tr key={p.id}>
                                    <td className="print-checkbox-col">□</td>
                                    <td>{p.name}</td>
                                    <td>{p.purpose}</td>
                                    <td>{p.quantity} {formatUnit(p.unit)}</td>
                                    <td>{p.location}</td>
                                    <td>{p.expiry}</td>
                                    <td>
                                        {p.weight !== undefined && p.weight !== null && p.weight !== ''
                                            ? `${p.weight} ${formatUnit(p.weightUnit || 'kg')}`
                                            : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            <div className="inhalt-print-footer mt-4 pt-2 border-t border-gray-300 flex justify-between">
                <span>CamperGuard Pro</span>
                <span>Gedruckt am: {new Date().toLocaleDateString('de-DE')}</span>
            </div>
        </div>
    );
}
