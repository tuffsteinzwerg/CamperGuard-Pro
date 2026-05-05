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
                    @page { size: A4 portrait; margin: 15mm; }
                    .inhalt-print-wrapper {
                        display: block !important;
                        width: 100%;
                        color: black !important;
                        font-family: sans-serif;
                        padding-bottom: 25mm;
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
                    .inhalt-print-title { font-size: 16pt !important; }
                    .inhalt-print-meta { font-size: 9pt !important; color: #555 !important; }
                    
                    .inhalt-print-section-wrap { page-break-inside: auto; }
                    .inhalt-print-section {
                        font-size: 12pt !important; 
                        page-break-after: avoid;
                        break-after: avoid;
                        margin-top: 15px;
                        margin-bottom: 10px;
                        background-color: #e5e7eb !important;
                        -webkit-print-color-adjust: exact;
                        color-adjust: exact;
                    }
                    
                    .inhalt-print-location { 
                        font-size: 10.5pt !important; 
                        page-break-after: avoid;
                        break-after: avoid;
                        margin-bottom: 5px; 
                    }
                    
                    .inhalt-print-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-bottom: 15px; 
                    }
                    .inhalt-print-table th, .inhalt-print-table td {
                        font-size: 9.5pt !important;
                    }
                    .inhalt-print-table th { 
                        background: transparent !important; 
                        font-weight: bold; 
                        padding: 4px; 
                        border-bottom: 2px solid #000 !important; 
                        text-align: left; 
                    }
                    .inhalt-print-table td { 
                        padding: 4px; 
                        border-bottom: 1px solid #ccc !important; 
                        vertical-align: top; 
                    }
                    .inhalt-print-table tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    .inhalt-print-footer, .inhalt-print-footer span { 
                        font-size: 8pt !important; 
                    }
                }
            `}</style>
            <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
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
                        <div key={sub} className="mb-4">
                            <h4 className="inhalt-print-location font-bold uppercase border-b border-gray-300 pb-1">{sub}</h4>
                            <table className="inhalt-print-table text-left">
                                <thead>
                                    <tr>
                                        <th>Artikel</th>
                                        <th className="w-24">Menge</th>
                                        <th className="w-24">Gewicht</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsInSubcat.map((item: any) => (
                                        <tr key={item.id}>
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
                    <div key={category} className="inhalt-print-section-wrap mb-6">
                        <h3 className="inhalt-print-section font-black px-2 py-1 uppercase">{category}</h3>
                        {categoryContent}
                    </div>
                );
            })}

            {gearFilter.length > 0 && (
                <div className="inhalt-print-section-wrap mb-6">
                    <h3 className="inhalt-print-section font-black px-2 py-1 uppercase">Notfallausrüstung</h3>
                    <table className="inhalt-print-table text-left">
                        <thead>
                            <tr>
                                <th>Artikel</th>
                                <th className="w-24">Menge</th>
                                <th className="w-32">Lagerorte</th>
                                <th className="w-24">Gewicht</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gearFilter.map((g: any) => (
                                <tr key={g.id}>
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
                <div className="inhalt-print-section-wrap mb-6">
                    <h3 className="inhalt-print-section font-black px-2 py-1 uppercase">Apotheke / Medikamente</h3>
                    <table className="inhalt-print-table text-left">
                        <thead>
                            <tr>
                                <th>Medikament</th>
                                <th>Zweck</th>
                                <th className="w-24">Menge</th>
                                <th>Lagerort</th>
                                <th className="w-24">Exp.</th>
                                <th className="w-24">Gewicht</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pharmacyFilter.map((p: any) => (
                                <tr key={p.id}>
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
            
            <div className="inhalt-print-footer mt-8 pt-4 border-t border-gray-300 flex justify-between">
                <span>CamperGuard Pro</span>
                <span>Gedruckt am: {new Date().toLocaleDateString('de-DE')}</span>
            </div>
        </div>
    );
}
