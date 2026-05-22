import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, AlertTriangle, Printer, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InhaltPrintView } from '../print/InhaltPrintView';

// --- TAB: INHALT ---

export function InhaltView({ state, setState }: any) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Küche");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [editingSub, setEditingSub] = useState<{old: string, new: string} | null>(null);
  const [deletingSub, setDeletingSub] = useState<string | null>(null);
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({ name: '', quantity: '1', unit: 'stk', weight: '', weightUnit: 'kg', subcategory: '' });
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  const [isAddingMainCategory, setIsAddingMainCategory] = useState(false);
  const [newMainCategoryName, setNewMainCategoryName] = useState("");
  const [deletingMainCategory, setDeletingMainCategory] = useState<string | null>(null);
  const [deletingMainCategoryError, setDeletingMainCategoryError] = useState<string | null>(null);
  const [showSortSubcategories, setShowSortSubcategories] = useState(false);

  const formatUnit = (u?: string) => {
    if (!u) return '';
    const lower = u.toLowerCase();
    if (lower === 'g' || lower === 'gr') return 'g';
    if (lower === 'stk' || lower === 'stück') return 'stk';
    if (lower === 'kg') return 'kg';
    if (lower === 'l' || lower === 'liter') return 'l';
    return u;
  };

  const moveSubcategory = (sub: string, direction: "up" | "down") => {
    const currentSubs = state.subcategories[activeCategory] || [];
    const index = currentSubs.indexOf(sub);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === currentSubs.length - 1) return;

    const newSubs = [...currentSubs];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newSubs[index], newSubs[targetIndex]] = [newSubs[targetIndex], newSubs[index]];

    setState({
      ...state,
      subcategories: {
        ...state.subcategories,
        [activeCategory]: newSubs
      }
    });
  };

  const fixedCategories = ["Küche", "Wohnen", "Bad", "Garage", "Technik"];
  const customCategories = Object.keys(state.subcategories || {}).filter(k => !fixedCategories.includes(k));
  const categories = [...fixedCategories, ...customCategories];

  const searchedItems = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    
    const inventoryResults = state.inventory.filter((item: any) => 
        (item.name && item.name.toLowerCase().includes(term)) || 
        (item.subcategory && item.subcategory.toLowerCase().includes(term)) ||
        (item.category && item.category.toLowerCase().includes(term))
    );

    const gearResults = (state.sos?.gear || [])
        .filter((g: any) => 
            g.checked === true && Number(g.count) > 0 && g.isHidden !== true && g.isDeleted !== true &&
            ((g.name && g.name.toLowerCase().includes(term)) ||
            (g.locations && g.locations.some((l: string) => l.toLowerCase().includes(term))) ||
            "notfall-ausrüstung".includes(term) ||
            "safety hub".includes(term))
        )
        .map((g: any) => ({
            id: `sos-gear-${g.id}`,
            name: g.name,
            category: "Safety Hub",
            subcategory: (g.locations && g.locations.length > 0 && g.locations[0]) ? g.locations[0] : "Notfall-Ausrüstung",
            quantity: g.count,
            unit: "stk",
            weight: g.weight,
            weightUnit: g.weightUnit || "kg",
            sourceType: "safety-gear"
        }));

    const pharmacyResults = (state.sos?.pharmacy || [])
        .filter((p: any) => {
            if (!p) return false;
            const pName = String(p.name || '');
            const pPurpose = String(p.purpose || '');
            const pLoc = String(p.location || '');
            const pUnit = String(p.unit || '');
            
            return pName.trim() !== '' && p.isHidden !== true && p.isDeleted !== true &&
            (pName.toLowerCase().includes(term) ||
            pPurpose.toLowerCase().includes(term) ||
            pLoc.toLowerCase().includes(term) ||
            pUnit.toLowerCase().includes(term) ||
            "apotheke".includes(term) ||
            "safety hub".includes(term));
        })
        .map((p: any) => ({
            id: `sos-pharmacy-${p.id}`,
            name: p.name,
            category: "Safety Hub",
            subcategory: p.location || "Apotheke",
            quantity: p.quantity,
            unit: p.unit,
            weight: p.weight,
            weightUnit: p.weightUnit || "kg",
            sourceType: "safety-pharmacy"
        }));

    return [...inventoryResults, ...gearResults, ...pharmacyResults];
  }, [state.inventory, state.sos, searchTerm]);

  const filteredItems = state.inventory.filter((item: any) => 
    item.category === activeCategory
  );

  const groupedBySub = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const uniqueSubs = Array.from(new Set(state.subcategories[activeCategory] || []));
    uniqueSubs.forEach((sub:any) => groups[sub as string] = []);
    
    filteredItems.forEach((item: any) => {
        if (groups[item.subcategory]) {
            groups[item.subcategory].push(item);
        }
    });
    return groups;
  }, [filteredItems, activeCategory, state.subcategories]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-4 px-2 no-print">
          <h1 className="typo-section-title">INHALT</h1>
          <button onClick={() => window.print()} className="cg-master-button !py-1.5 !px-3"><Printer size={14}/></button>
      </div>

      <div className="relative no-print mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
        <input type="text" placeholder="Bestand durchsuchen..." className="cg-master-input w-full !pl-[34px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="no-print pb-4 flex gap-2">
          <select 
              value={activeCategory} 
              onChange={e => {
                  if (e.target.value === '__sort__') {
                      setShowSortSubcategories(true);
                  } else {
                      setActiveCategory(e.target.value);
                  }
              }} 
              className="cg-master-input flex-1"
          >
              {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-[var(--bg-card)] text-white">{cat}</option>
              ))}
              <option disabled className="bg-[var(--bg-card)] text-white/50" value="__divider__">──────────</option>
              <option value="__sort__" className="bg-[var(--bg-card)] text-[var(--accent)]">Lagerorte in „{activeCategory}“ sortieren</option>
          </select>
          <button onClick={() => setIsAddingMainCategory(true)} className="cg-master-button !py-1.5 !px-3"><Plus size={14} /></button>
          {!fixedCategories.includes(activeCategory) && (
              <button 
                  onClick={() => {
                      const hasSubcats = (state.subcategories[activeCategory] || []).length > 0;
                      const hasItems = state.inventory.some((i: any) => i.category === activeCategory);
                      if (hasSubcats || hasItems) {
                          setDeletingMainCategoryError("Dieser Bereich kann erst gelöscht werden, wenn er leer ist.");
                      } else {
                          setDeletingMainCategory(activeCategory);
                      }
                  }} 
                  className="cg-master-button px-3 text-red-500"
              >
                  <Trash2 size={16}/>
              </button>
          )}
      </div>

      <div className="no-print">
      {searchTerm ? (
          <div className="space-y-4 print-only print-table">
              <div className="mb-4">
                  <div className="flex justify-between items-baseline border-b border-[var(--border)] pb-1 mb-2">
                      <h3 className="typo-body text-white/70">Suchergebnisse ({searchedItems.length})</h3>
                  </div>
                  {searchedItems.length === 0 ? (
                      <div className="text-center py-10 typo-body-dim text-[var(--text-muted)]">Keine Ergebnisse gefunden</div>
                  ) : (
                      <div className="w-full mb-4 space-y-3">
                          {searchedItems.map((item:any) => (
                              <div key={item.id} className={`cg-master-card-small flex items-center justify-between ${item.quantity === 0 ? '!border-[var(--status-danger)]' : ''}`}>
                                  <div className="flex-1">
                                      <div className="typo-card-title">{item.name}</div>
                                      {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) && (
                                          <div className="typo-body-dim !mb-0">
                                              {item.weight} {formatUnit(item.weightUnit)}
                                          </div>
                                      )}
                                      <div className="typo-body-dim text-[var(--text-tertiary)]">
                                          {item.category} / {item.subcategory}
                                      </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 mx-4">
                                      <span className={`typo-value-normal ${item.quantity === 0 ? 'cg-master-muted' : ''}`}>{item.quantity}</span>
                                      <span className="typo-value-small ml-1">{formatUnit(item.unit)}</span>
                                  </div>
                                  <div className="flex justify-end items-center gap-3 no-print flex-shrink-0 w-16">
                                      {!item.sourceType && (
                                          <>
                                              <button onClick={() => { setActiveCategory(item.category); setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory }); setEditingItem(item); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
                                              <button onClick={() => setDeletingItem(item)} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14} /></button>
                                          </>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      ) : (
          <div className="space-y-4 print-only print-table">
          {Array.from(new Set(state.subcategories[activeCategory] || [])).map((sub:any) => (
              <div key={sub} className="mb-4">
                  <div 
                      className="cg-master-card-small flex justify-between items-center cursor-pointer select-none"
                      onClick={() => setActiveAccordion(activeAccordion === sub ? null : sub)}
                  >
                      <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                          <h3 className="typo-section-title min-w-0 flex-1 line-clamp-2" style={{ color: 'var(--accent)', marginBottom: 0, minHeight: '32px' }}>{sub}</h3>
                          <span className="typo-value-small whitespace-nowrap mt-0.5">
                              {(() => {
                                  const totalKg = (groupedBySub[sub] || []).reduce((acc: number, item: any) => {
                                      if (item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) {
                                          const unit = (item.weightUnit || 'kg').toLowerCase();
                                          if (unit === 'gr' || unit === 'g') {
                                              return acc + (item.weight * (item.quantity || 0)) / 1000;
                                          }
                                          return acc + (item.weight * (item.quantity || 0));
                                      }
                                      return acc;
                                  }, 0);
                                  return `${Math.round(totalKg)} kg`;
                              })()}
                          </span>
                      </div>
                      <div className="flex items-center gap-2 no-print shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditingSub({old: sub, new: sub})} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
                          <button onClick={() => setDeletingSub(sub)} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14} /></button>
                      </div>
                  </div>
                  {activeAccordion === sub && (
                      <div className="w-full mb-4 space-y-3 mt-3">
                          {(groupedBySub[sub] || []).map((item:any) => (
                              <div key={item.id} className={`cg-master-card-small flex items-center justify-between ${item.quantity === 0 ? '!border-[var(--status-danger)]' : ''}`}>
                                  <div className="flex-1">
                                      <div className="typo-card-title">{item.name}</div>
                                      {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) && (
                                          <div className="typo-body-dim !mb-0">
                                              {item.weight} {formatUnit(item.weightUnit)}
                                          </div>
                                      )}
                                  </div>
                                  <div className="text-right flex-shrink-0 mx-4">
                                      <span className={`typo-value-normal ${item.quantity === 0 ? 'cg-master-muted' : ''}`}>{item.quantity}</span>
                                      <span className="typo-value-small ml-1">{formatUnit(item.unit)}</span>
                                  </div>
                                  <div className="flex justify-end items-center gap-3 no-print flex-shrink-0 w-16">
                                      <button onClick={() => { setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory }); setEditingItem(item); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
                                      <button onClick={() => setDeletingItem(item)} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14} /></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          ))}
          </div>
      )}
      </div>

      <InhaltPrintView state={state} />

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none px-4 flex items-center justify-center gap-3 z-40 no-print">
          <button onClick={() => setIsAddingSub(true)} className="cg-master-button rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Lagerort</button>
          <button onClick={() => { setItemForm({ name: '', quantity: '1', unit: 'stk', weight: '', weightUnit: 'kg', subcategory: '' }); setIsAddingItem(true); }} className="cg-master-button rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Artikel</button>
      </div>

      <AnimatePresence>
        {isAddingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Artikel</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const newItem = { 
                            id: Date.now().toString(), 
                            name: itemForm.name, 
                            quantity: parseFloat(itemForm.quantity) || 0, 
                            unit: itemForm.unit, 
                            category: activeCategory, 
                            subcategory: itemForm.subcategory,
                            weight: itemForm.weight ? parseFloat(itemForm.weight) : undefined,
                            weightUnit: itemForm.weightUnit
                        };
                        setState({...state, inventory: [...state.inventory, newItem]});
                        setIsAddingItem(false);
                    }}>
                        <div className="space-y-3">
                            <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Name" className="cg-master-input w-full" />
                            <div className="flex gap-3">
                                <input required type="number" step={formatUnit(itemForm.unit) === 'stk' ? "1" : "0.01"} min={formatUnit(itemForm.unit) === 'stk' ? "1" : "0"} value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} placeholder="Menge" className="cg-master-input w-24" />
                                <select value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="cg-master-input w-24">
                                    <option value="stk">stk</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <input type="number" step="0.01" min="0" value={itemForm.weight} onChange={e => setItemForm({...itemForm, weight: e.target.value})} placeholder="Gewicht pro Stk/Einheit (opt)" className="cg-master-input w-24" />
                                <select value={itemForm.weightUnit} onChange={e => setItemForm({...itemForm, weightUnit: e.target.value})} className="cg-master-input w-24">
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                </select>
                            </div>
                            <select required value={itemForm.subcategory} onChange={e => setItemForm({...itemForm, subcategory: e.target.value})} className="cg-master-input w-full">
                                <option value="" disabled>Lagerort wählen...</option>
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6"><button type="button" onClick={() => setIsAddingItem(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button><button type="submit" className="cg-master-button flex-1 !p-3">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Artikel bearbeiten</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const updatedItem = {
                            ...editingItem,
                            name: itemForm.name, 
                            quantity: parseFloat(itemForm.quantity) || 0, 
                            unit: itemForm.unit, 
                            subcategory: itemForm.subcategory,
                            weight: itemForm.weight ? parseFloat(itemForm.weight) : undefined,
                            weightUnit: itemForm.weightUnit
                        };
                        const newInv = state.inventory.map((i:any) => i.id === editingItem.id ? updatedItem : i);
                        setState({...state, inventory: newInv});
                        setEditingItem(null);
                    }}>
                        <div className="space-y-3">
                            <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Name" className="cg-master-input w-full" />
                            <div className="flex gap-3">
                                <input required type="number" step={formatUnit(itemForm.unit) === 'stk' ? "1" : "0.01"} min={formatUnit(itemForm.unit) === 'stk' ? "1" : "0"} value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} placeholder="Menge" className="cg-master-input w-24" />
                                <select value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="cg-master-input w-24">
                                    <option value="stk">stk</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <input type="number" step="0.01" min="0" value={itemForm.weight} onChange={e => setItemForm({...itemForm, weight: e.target.value})} placeholder="Gewicht pro Stk/Einheit (opt)" className="cg-master-input w-24" />
                                <select value={itemForm.weightUnit} onChange={e => setItemForm({...itemForm, weightUnit: e.target.value})} className="cg-master-input w-24">
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                </select>
                            </div>
                            <select required value={itemForm.subcategory} onChange={e => setItemForm({...itemForm, subcategory: e.target.value})} className="cg-master-input w-full">
                                <option value="" disabled>Lagerort wählen...</option>
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setEditingItem(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                            <button type="submit" className="cg-master-button flex-1 !p-3">Speichern</button>
                        </div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Artikel löschen</h2>
                    <p className="typo-body">Willst du <strong>{deletingItem.name}</strong> wirklich aus dem Inhalt entfernen?</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingItem(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const newInv = state.inventory.filter((i:any) => i.id !== deletingItem.id);
                            setState({...state, inventory: newInv});
                            setDeletingItem(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Lagerort</h2>
                    <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Name" className="cg-master-input w-full" />
                    <div className="flex gap-3 mt-6"><button onClick={() => setIsAddingSub(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button><button onClick={() => { if(newSubName){ setState({...state, subcategories: {...state.subcategories, [activeCategory]: Array.from(new Set([...(state.subcategories[activeCategory]||[]), newSubName]))}}); setNewSubName(""); setIsAddingSub(false); } }} className="cg-master-button flex-1 !p-3">Speichern</button></div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Lagerort umbenennen</h2>
                    <input value={editingSub.new} onChange={e => setEditingSub({...editingSub, new: e.target.value})} placeholder="Neuer Name" className="cg-master-input w-full" />
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setEditingSub(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            if(editingSub.new && editingSub.new !== editingSub.old) {
                                const newSubs = Array.from(new Set((state.subcategories[activeCategory]||[]).map((s:string) => s === editingSub.old ? editingSub.new : s)));
                                const newInv = state.inventory.map((i:any) => i.category === activeCategory && i.subcategory === editingSub.old ? { ...i, subcategory: editingSub.new } : i);
                                setState({...state, subcategories: {...state.subcategories, [activeCategory]: newSubs}, inventory: newInv});
                            }
                            setEditingSub(null);
                        }} className="cg-master-button flex-1 !p-3">Speichern</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Lagerort löschen</h2>
                    <p className="typo-body">Willst du den Lagerort <strong>{deletingSub}</strong> wirklich löschen? Alle {(groupedBySub[deletingSub] || []).length} Artikel darin werden ebenfalls entfernt!</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingSub(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const newSubs = (state.subcategories[activeCategory]||[]).filter((s:string) => s !== deletingSub);
                            const newInv = state.inventory.filter((i:any) => !(i.category === activeCategory && i.subcategory === deletingSub));
                            setState({...state, subcategories: {...state.subcategories, [activeCategory]: newSubs}, inventory: newInv});
                            setDeletingSub(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingMainCategory && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Hauptbereich</h2>
                    <input value={newMainCategoryName} onChange={e => setNewMainCategoryName(e.target.value)} placeholder="Name" className="cg-master-input w-full" />
                    <div className="flex gap-3 mt-6"><button onClick={() => setIsAddingMainCategory(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                    <button onClick={() => { 
                        if(newMainCategoryName && !categories.includes(newMainCategoryName)){ 
                            setState({...state, subcategories: {...state.subcategories, [newMainCategoryName]: []}}); 
                            setActiveCategory(newMainCategoryName);
                            setNewMainCategoryName(""); 
                            setIsAddingMainCategory(false); 
                        } 
                    }} className="cg-master-button flex-1 !p-3">Speichern</button></div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingMainCategory && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Bereich löschen</h2>
                    <p className="typo-body">Willst du diesen Bereich wirklich löschen?</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingMainCategory(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const newSubs = { ...state.subcategories };
                            delete newSubs[deletingMainCategory];
                            setState({...state, subcategories: newSubs});
                            setActiveCategory("Küche");
                            setDeletingMainCategory(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingMainCategoryError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Fehler</h2>
                    <p className="typo-body">{deletingMainCategoryError}</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingMainCategoryError(null)} className="cg-master-button flex-1 !p-3">OK</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSortSubcategories && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm max-h-[80vh] flex flex-col">
                    <h2 className="typo-section-title mb-4">Lagerorte in „{activeCategory}“ sortieren</h2>
                    <div className="overflow-y-auto flex-1 space-y-2 mb-4 pr-1">
                        {(!state.subcategories[activeCategory] || state.subcategories[activeCategory].length === 0) ? (
                            <p className="typo-body">Keine Lagerorte vorhanden. Tippe auf „+ Lagerort" um einen Staubereich anzulegen.</p>
                        ) : (
                            state.subcategories[activeCategory].map((sub: string, index: number, arr: string[]) => (
                                <div key={sub} className="cg-master-card-small !p-3 flex justify-between items-center bg-[var(--bg-card)]">
                                    <span className="typo-body font-medium truncate pr-2" title={sub}>{sub}</span>
                                    <div className="flex gap-1 shrink-0">
                                        <button 
                                            onClick={() => moveSubcategory(sub, "up")} 
                                            disabled={index === 0}
                                            className={`cg-master-button !p-2 !rounded bg-white/10 hover:bg-white/20 transition-colors border border-white/10 ${index === 0 ? 'opacity-25 cursor-not-allowed' : 'opacity-100'}`}
                                            title="nach oben"
                                        >
                                            <ChevronUp size={20} className="text-white drop-shadow-sm" strokeWidth={2.5} />
                                        </button>
                                        <button 
                                            onClick={() => moveSubcategory(sub, "down")} 
                                            disabled={index === arr.length - 1}
                                            className={`cg-master-button !p-2 !rounded bg-white/10 hover:bg-white/20 transition-colors border border-white/10 ${index === arr.length - 1 ? 'opacity-25 cursor-not-allowed' : 'opacity-100'}`}
                                            title="nach unten"
                                        >
                                            <ChevronDown size={20} className="text-white drop-shadow-sm" strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex gap-3 mt-auto shrink-0">
                        <button onClick={() => setShowSortSubcategories(false)} className="cg-master-button flex-1 !p-3">Fertig</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

