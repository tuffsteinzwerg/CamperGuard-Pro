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
        <div className="hidden print-only logbuch-print-wrapper bg-white">
            <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-widest">{state.profile?.vehicleName || "Camper"}</h1>
                    <p className="text-xs font-bold uppercase">{state.profile?.plate || "Kennzeichen"}</p>
                </div>
                <h2 className="text-lg font-black uppercase">Inhaltsliste</h2>
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
                        <div key={sub} className="mb-6">
                            <h4 className="text-md font-bold mb-2 uppercase border-b border-gray-300">{sub}</h4>
                            <table className="print-table w-full text-left">
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
                    <div key={category} className="mb-8">
                        <h3 className="text-lg font-black bg-gray-200 px-2 py-1 mb-4 uppercase">{category}</h3>
                        {categoryContent}
                    </div>
                );
            })}

            {gearFilter.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-lg font-black bg-gray-200 px-2 py-1 mb-4 uppercase">Notfallausrüstung</h3>
                    <table className="print-table w-full text-left">
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
                <div className="mb-8">
                    <h3 className="text-lg font-black bg-gray-200 px-2 py-1 mb-4 uppercase">Apotheke / Medikamente</h3>
                    <table className="print-table w-full text-left">
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
            
            <div className="mt-10 pt-4 border-t border-gray-300 flex justify-between typo-label text-xs">
                <span>CamperGuard Pro</span>
                <span>Gedruckt am: {new Date().toLocaleDateString('de-DE')}</span>
            </div>
        </div>
    );
}
