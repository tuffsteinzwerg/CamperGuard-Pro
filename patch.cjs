const fs = require('fs');
let content = fs.readFileSync('src/print/InhaltPrintView.tsx', 'utf8');

const targetStr = `                {allCategories.map(category => {
                    const items = consumables.filter((i: InventoryItem) => i.category === category);
                    if (items.length === 0) return null;
                    return (
                        <div key={category}>
                            <div className="cg-print-section-title"><span className="cg-print-icon-sm">🛒</span> {category.toUpperCase()}</div>
                            <div className="inv-col-header cg-print-col-header">
                                <div className="cg-print-align-center">✓</div>
                                <div className="cg-print-align-left-pad">Artikel</div>
                                <div className="cg-print-align-right">Menge</div>
                                <div className="cg-print-align-right">Gewicht</div>
                            </div>
                            {items.map((item: InventoryItem) => (
                                <div className="inv-row cg-print-row" key={item.id}>
                                    <div className="cg-print-cell-check">□</div>
                                    <div className="cg-print-cell-name">{item.name}</div>
                                    <div className="cg-print-cell-num">{item.quantity} {formatUnit(item.unit)}</div>
                                    <div className="cg-print-cell-num">
                                        {item.weight !== undefined && item.weight !== null
                                            ? \`\${item.weight} \${formatUnit(item.weightUnit || 'kg')}\`
                                            : ''}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })}`;

const replacementStr = `                {allCategories.map(category => {
                    const itemsInCategory = consumables.filter((i: InventoryItem) => i.category === category);
                    if (itemsInCategory.length === 0) return null;
                    const subcats = Array.from(new Set(state.subcategories[category] || []));
                    return (
                        <div key={category}>
                            <div className="cg-print-section-title"><span className="cg-print-icon-sm">🛒</span> {category.toUpperCase()}</div>
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
                                                        ? \`\${item.weight} \${formatUnit(item.weightUnit || 'kg')}\`
                                                        : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync('src/print/InhaltPrintView.tsx', content, 'utf8');
    console.log('Replaced successfully.');
} else {
    console.log('Target string not found.');
    // Try doing a normalize whitespace replacement or something
}
