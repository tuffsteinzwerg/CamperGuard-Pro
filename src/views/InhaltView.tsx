import { createUuid } from "../lib/uuid.ts";
import React, { useState, useMemo, useEffect } from 'react';
import { lookupProduct, saveProduct } from '../lib/productLookup';
import { BarcodeScanner } from '../components/BarcodeScanner';
import type { AppState, SpotEntry, InventoryItem, EmergencyGear, PharmacyItem } from '../types';
import { Plus, Trash2, Search, AlertTriangle, Printer, Edit2, ChevronDown, ChevronUp, History, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InhaltPrintView } from '../print/InhaltPrintView';
import { dispatchInventoryEvent } from '../lib/syncRepository';
import { openAppDatabase } from '../lib/appDatabase';
import { formatWeight } from '../lib/formatters';
import { startSync, subscribeSyncStatus, countPendingOutbox } from '../lib/syncRuntime';
import type { SyncStatus } from '../lib/syncCoordinator';

// --- TAB: INHALT ---

interface InhaltViewProps {
  state: AppState;
  setState: React.Dispatch<any>;
}

export function InhaltView({ state, setState }: InhaltViewProps) {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    startSync();
    const unsubscribe = subscribeSyncStatus(setSyncStatus);
    const refresh = () => { countPendingOutbox().then(setPendingCount); };
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => { unsubscribe(); clearInterval(iv); };
  }, []);

  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');

  const openHistory = async () => {
    const db = await openAppDatabase();
    const logs = await db.getAll('eventLog');
    const dId = await db.get('appMeta', 'deviceId');
    db.close();
    logs.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    setHistoryLogs(logs.slice(0, 100));
    setDeviceId(dId);
    setShowHistory(true);
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Küche");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [editingSub, setEditingSub] = useState<{old: string, new: string} | null>(null);
  const [deletingSub, setDeletingSub] = useState<string | null>(null);
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({ name: '', quantity: '1', unit: 'stk', weight: '', weightUnit: 'kg', subcategory: '', consumable: false });
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  const [isAddingMainCategory, setIsAddingMainCategory] = useState(false);
  const [scanEan, setScanEan] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [showGrossHint, setShowGrossHint] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [printMode, setPrintMode] = useState<'all' | 'consumables'>('all');
  const [pendingPrint, setPendingPrint] = useState(false);
  useEffect(() => {
    if (!pendingPrint) return;
    window.print();
    setPendingPrint(false);
  }, [pendingPrint]);
  const runPrint = (mode: 'all' | 'consumables') => {
    setPrintMenuOpen(false);
    setPrintMode(mode);
    setPendingPrint(true);
  };
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

    dispatchInventoryEvent(state, 'subcategory_reordered', 'struct:' + activeCategory, { category: activeCategory, order: newSubs })
      .then(setState)
      .catch(err => { console.error(err); alert('Fehler: ' + err.message); });
  };


  const handleLookup = async (eanArg?: string) => {
    const ean = (eanArg ?? scanEan).trim();
    if (!ean) return;
    setLookupBusy(true); setLookupMsg(null); setShowGrossHint(false);
    try {
      const info = await lookupProduct(ean);
      if (info.source === 'none' || (!info.name && info.grossWeight == null && info.netWeight == null)) {
        setLookupMsg('Nicht gefunden – bitte von Hand eintragen. Deine Angaben helfen beim nächsten Mal.');
      } else {
        const w = info.grossWeight != null ? info.grossWeight : info.netWeight;
        const u = info.grossWeight != null ? (info.grossUnit || 'g') : (info.netUnit || 'g');
        setItemForm(f => ({
          ...f,
          name: info.name || f.name,
          weight: (w != null && !isNaN(Number(w))) ? String(w) : f.weight,
          weightUnit: (u === 'kg' ? 'kg' : 'g')
        }));
        if (info.grossWeight == null && info.netWeight != null) setShowGrossHint(true);
        setLookupMsg(info.source === 'own' ? 'Gefunden (Camper-Datenbank)' : 'Gefunden (Open Food Facts)');
      }
    } catch {
      setLookupMsg('Keine Verbindung – bitte von Hand eintragen.');
    } finally {
      setLookupBusy(false);
    }
  };

  const fixedCategories = ["Küche", "Wohnen", "Bad", "Garage", "Technik"];
  const customCategories = Object.keys(state.subcategories || {}).filter(k => !fixedCategories.includes(k));
  const categories = [...fixedCategories, ...customCategories];

  const searchedItems = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    
    const inventoryResults = state.inventory.filter((item: InventoryItem) => 
        !item.deletedAt &&
        ((item.name && item.name.toLowerCase().includes(term)) || 
        (item.subcategory && item.subcategory.toLowerCase().includes(term)) ||
        (item.category && item.category.toLowerCase().includes(term)))
    );

    const gearResults = (state.sos?.gear || [])
        .filter((g: EmergencyGear) => 
            g.checked === true && Number(g.count) > 0 && g.isHidden !== true && g.isDeleted !== true &&
            ((g.name && g.name.toLowerCase().includes(term)) ||
            (g.locations && g.locations.some((l: string) => l.toLowerCase().includes(term))) ||
            "notfall-ausrüstung".includes(term) ||
            "safety hub".includes(term))
        )
        .map((g: EmergencyGear) => ({
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
        .filter((p: PharmacyItem) => {
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
        .map((p: PharmacyItem) => ({
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

  const filteredItems = state.inventory.filter((item: InventoryItem) => 
    !item.deletedAt && item.category === activeCategory
  );

  const groupedBySub = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const uniqueSubs = Array.from(new Set(state.subcategories[activeCategory] || []));
    uniqueSubs.forEach((sub: string) => groups[sub as string] = []);
    
    filteredItems.forEach((item: InventoryItem) => {
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
          <div className="flex items-center gap-2">
            <button onClick={openHistory} className="cg-master-button !py-1.5 !px-3">
              <History
                size={14}
                className={
                  (syncStatus === 'uploading' || syncStatus === 'downloading' || pendingCount > 0)
                    ? 'text-[var(--status-danger)]'
                    : 'text-[#00ff9c]'
                }
              />
            </button>
            <div className="relative">
              <button onClick={() => setPrintMenuOpen(o => !o)} className="cg-master-button !py-1.5 !px-3 flex items-center gap-1"><Printer size={14}/><ChevronDown size={12}/></button>
              {printMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPrintMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 z-50 cg-master-card-small !p-1 min-w-[210px]">
                    <button onClick={() => runPrint('all')} className="w-full text-left px-3 py-2 rounded typo-body hover:bg-[var(--bg-input)]">Ganzer Inhalt</button>
                    <button onClick={() => runPrint('consumables')} className="w-full text-left px-3 py-2 rounded typo-body hover:bg-[var(--bg-input)]">Nur Verbrauchsmaterial</button>
                  </div>
                </>
              )}
            </div>
          </div>
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
                      const hasItems = state.inventory.some((i: InventoryItem) => i.category === activeCategory);
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
                          {searchedItems.map((item: InventoryItem) => (
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
                                      {!(item as any).sourceType && (
                                          <>
                                              <button onClick={() => { setActiveCategory(item.category); setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory, consumable: item.consumable ?? false }); setEditingItem(item); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
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
          {Array.from(new Set(state.subcategories[activeCategory] || [])).map((sub: string) => (
              <div key={sub} className="mb-4">
                  <div 
                      className="cg-master-card-small flex justify-between items-center cursor-pointer select-none"
                      onClick={() => setActiveAccordion(activeAccordion === sub ? null : sub)}
                  >
                      <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                          <h3 className="typo-section-title min-w-0 flex-1 line-clamp-2" style={{ color: 'var(--accent)', marginBottom: 0, minHeight: '32px' }}>{sub}</h3>
                          <span className="typo-value-small whitespace-nowrap mt-0.5">
                              {(() => {
                                  const totalKg = (groupedBySub[sub] || []).reduce((acc: number, item: InventoryItem) => {
                                      if (item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) {
                                          const unit = (item.weightUnit || 'kg').toLowerCase();
                                          if (unit === 'gr' || unit === 'g') {
                                              return acc + (item.weight * (item.quantity || 0)) / 1000;
                                          }
                                          return acc + (item.weight * (item.quantity || 0));
                                      }
                                      return acc;
                                  }, 0);
                                  return totalKg > 0 ? formatWeight(totalKg) : '0 kg';
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
                          {(groupedBySub[sub] || []).map((item: InventoryItem) => (
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
                                      <button onClick={() => { setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory, consumable: item.consumable ?? false }); setEditingItem(item); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
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

      <InhaltPrintView state={state} printMode={printMode} />

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none px-4 flex items-center justify-center gap-3 z-40 no-print">
          <button onClick={() => setIsAddingSub(true)} className="cg-master-button rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Lagerort</button>
          <button onClick={() => { setItemForm({ name: '', quantity: '1', unit: 'stk', weight: '', weightUnit: 'kg', subcategory: '', consumable: false }); setScanEan(''); setLookupMsg(null); setShowGrossHint(false); setIsAddingItem(true); }} className="cg-master-button rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Artikel</button>
      </div>

      <AnimatePresence>
        {isAddingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Artikel</h2>
                    <form onSubmit={(e: React.FormEvent) => {
                        e.preventDefault();
                        const newItemId = createUuid();
                        const eanTrim = scanEan.trim();
                        const payload = { 
                            name: itemForm.name, 
                            quantity: parseFloat(itemForm.quantity) || 0, 
                            unit: itemForm.unit, 
                            category: activeCategory, 
                            subcategory: itemForm.subcategory,
                            weight: itemForm.weight ? parseFloat(itemForm.weight) : undefined,
                            weightUnit: itemForm.weightUnit,
                            ean: eanTrim || undefined,
                            consumable: itemForm.consumable
                        };
                        dispatchInventoryEvent(state, 'item_created', newItemId, payload).then(newState => {
                            setState(newState);
                            setIsAddingItem(false);
                            if (eanTrim) {
                                saveProduct({
                                    ean: eanTrim,
                                    name: payload.name,
                                    grossWeight: payload.weight,
                                    grossUnit: payload.weightUnit
                                });
                            }
                        });
                    }}>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input value={scanEan} onChange={e => setScanEan(e.target.value)} inputMode="numeric" placeholder="EAN / Barcode (optional)" className="cg-master-input flex-1" />
                                <button type="button" onClick={() => setShowScanner(true)} className="cg-master-button !px-3" title="Scannen"><ScanLine size={16} /></button>
                                <button type="button" onClick={() => handleLookup()} disabled={lookupBusy || !scanEan.trim()} className="cg-master-button !px-4 disabled:opacity-50">{lookupBusy ? '…' : 'Suchen'}</button>
                            </div>
                            {lookupMsg && <div className="typo-body-dim">{lookupMsg}</div>}
                            {showGrossHint && <div className="typo-body text-[var(--accent)]">Hinweis: Das gefundene Gewicht ist nur der Inhalt (z. B. Doseninhalt), nicht die volle Verpackung. Bitte einmal die volle Packung wiegen und das Gewicht anpassen – das hilft auch allen anderen.</div>}
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
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s: any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <label className="flex items-center gap-2 typo-body cursor-pointer select-none mt-3">
                                <input type="checkbox" checked={itemForm.consumable} onChange={e => setItemForm({...itemForm, consumable: e.target.checked})} className="w-4 h-4 accent-[var(--accent)]" />
                                Verbrauchsmaterial (für Nachfüllliste)
                            </label>
                        </div>
                        <div className="flex gap-3 mt-6"><button type="button" onClick={() => setIsAddingItem(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button><button type="submit" className="cg-master-button flex-1 !p-3">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {showScanner && (
        <BarcodeScanner
          onDetected={(code) => {
            setShowScanner(false);
            const eanTrim = code.trim();
            const existing = eanTrim
              ? state.inventory.find(it => !it.deletedAt && it.ean === eanTrim)
              : undefined;
            if (existing) {
              dispatchInventoryEvent(state, 'quantity_delta', existing.id, { delta: 1 }, existing.version).then(newState => {
                setState(newState);
                setIsAddingItem(false);
                alert('„' + existing.name + '" schon da → Menge +1 (jetzt ' + (existing.quantity + 1) + ')');
              });
            } else {
              setScanEan(code);
              setItemForm(f => ({ ...f, consumable: true }));
              handleLookup(code);
            }
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      <AnimatePresence>
        {editingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Artikel bearbeiten</h2>
                    <form onSubmit={(e: React.FormEvent) => {
                        e.preventDefault();
                        const updatePayload = {
                            name: itemForm.name, 
                            unit: itemForm.unit, 
                            subcategory: itemForm.subcategory,
                            weight: itemForm.weight ? parseFloat(itemForm.weight) : undefined,
                            weightUnit: itemForm.weightUnit,
                            consumable: itemForm.consumable
                        };
                        const oldQuantity = editingItem.quantity || 0;
                        const newQuantity = parseFloat(itemForm.quantity) || 0;
                        const delta = newQuantity - oldQuantity;

                        const hasFieldChanges = editingItem.name !== updatePayload.name || 
                                                editingItem.unit !== updatePayload.unit || 
                                                editingItem.subcategory !== updatePayload.subcategory || 
                                                editingItem.weight !== updatePayload.weight || 
                                                editingItem.weightUnit !== updatePayload.weightUnit ||
                                                (editingItem.consumable ?? false) !== updatePayload.consumable;

                        let promise = Promise.resolve(state);
                        if (hasFieldChanges) {
                            promise = promise.then(s => dispatchInventoryEvent(s, 'item_updated', editingItem.id, updatePayload, editingItem.version));
                        }
                        if (delta !== 0) {
                            promise = promise.then(s => dispatchInventoryEvent(s, 'quantity_delta', editingItem.id, { delta }, editingItem.version));
                        }
                        promise.then(newState => {
                            setState(newState);
                            setEditingItem(null);
                        }).catch(err => {
                            console.error(err);
                            alert('Fehler beim Speichern: ' + err.message);
                        });
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
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s: any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <label className="flex items-center gap-2 typo-body cursor-pointer select-none mt-3">
                                <input type="checkbox" checked={itemForm.consumable} onChange={e => setItemForm({...itemForm, consumable: e.target.checked})} className="w-4 h-4 accent-[var(--accent)]" />
                                Verbrauchsmaterial (für Nachfüllliste)
                            </label>
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
                            dispatchInventoryEvent(state, 'item_removed', deletingItem.id, undefined, deletingItem.version).then(newState => {
                                setState(newState);
                                setDeletingItem(null);
                            }).catch(err => {
                                console.error(err);
                                alert('Fehler: ' + err.message);
                            });
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
                    <div className="flex gap-3 mt-6"><button onClick={() => setIsAddingSub(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button><button onClick={() => { if(newSubName){ dispatchInventoryEvent(state, 'subcategory_added', 'struct:' + activeCategory, { category: activeCategory, name: newSubName }).then(newState => { setState(newState); setNewSubName(""); setIsAddingSub(false); }).catch(err => { console.error(err); alert('Fehler: ' + err.message); }); } }} className="cg-master-button flex-1 !p-3">Speichern</button></div>
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
                                const itemsToUpdate = state.inventory.filter((i: InventoryItem) => i.category === activeCategory && i.subcategory === editingSub.old);

                                let promise = Promise.resolve(state);
                                for (const item of itemsToUpdate) {
                                    promise = promise.then(s => dispatchInventoryEvent(s, 'item_updated', item.id, { subcategory: editingSub.new }, item.version));
                                }
                                promise = promise.then(s => dispatchInventoryEvent(s, 'subcategory_renamed', 'struct:' + activeCategory, { category: activeCategory, from: editingSub.old, to: editingSub.new }));

                                promise.then(newState => {
                                    setState(newState);
                                    setEditingSub(null);
                                }).catch(err => {
                                    console.error(err);
                                    alert('Fehler: ' + err.message);
                                });
                            } else {
                                setEditingSub(null);
                            }
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
                            const itemsToDelete = state.inventory.filter((i: InventoryItem) => i.category === activeCategory && i.subcategory === deletingSub);

                            let promise = Promise.resolve(state);
                            for (const item of itemsToDelete) {
                                promise = promise.then(s => dispatchInventoryEvent(s, 'item_removed', item.id, undefined, item.version));
                            }
                            promise = promise.then(s => dispatchInventoryEvent(s, 'subcategory_removed', 'struct:' + activeCategory, { category: activeCategory, name: deletingSub }));

                            promise.then(newState => {
                                setState(newState);
                                setDeletingSub(null);
                            }).catch(err => {
                                console.error(err);
                                alert('Fehler: ' + err.message);
                            });
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
                            const neuerBereich = newMainCategoryName;
                            dispatchInventoryEvent(state, 'category_added', 'struct:' + neuerBereich, { category: neuerBereich })
                              .then(newState => {
                                setState(newState);
                                setActiveCategory(neuerBereich);
                                setNewMainCategoryName(""); 
                                setIsAddingMainCategory(false); 
                              })
                              .catch(err => { console.error(err); alert('Fehler: ' + err.message); });
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
                            const itemsToDelete = state.inventory.filter((i: InventoryItem) => i.category === deletingMainCategory);
                            let promise = Promise.resolve(state);
                            for (const item of itemsToDelete) {
                                promise = promise.then(s => dispatchInventoryEvent(s, 'item_removed', item.id, undefined, item.version));
                            }
                            promise = promise.then(s => dispatchInventoryEvent(s, 'category_removed', 'struct:' + deletingMainCategory, { category: deletingMainCategory }));
                            promise.then(newState => {
                                setState(newState);
                                setActiveCategory("Küche");
                                setDeletingMainCategory(null);
                            }).catch(err => {
                                console.error(err);
                                alert('Fehler: ' + err.message);
                            });
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

      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
            <div className="cg-master-card-small w-full max-w-sm max-h-[80vh] flex flex-col">
              <h2 className="typo-section-title mb-4">Änderungen</h2>
              <div className="overflow-y-auto flex-1 space-y-2 mb-4 pr-1">
                {historyLogs.length === 0 ? (
                  <p className="typo-body">Noch keine Änderungen.</p>
                ) : historyLogs.map((log) => {
                  const e = log.event;
                  const p = e?.payload;
                  let text = '';
                  if (e?.type === 'item_created') text = 'Angelegt: ' + (p?.name ?? '');
                  else if (e?.type === 'item_updated') text = 'Geändert: ' + (p?.name ?? String(e.itemId).slice(0,8));
                  else if (e?.type === 'quantity_delta') text = 'Menge ' + (p?.delta > 0 ? '+' : '') + p?.delta;
                  else if (e?.type === 'item_removed') text = 'Entfernt';
                  else if (e?.type === 'item_restored') text = 'Wiederhergestellt';
                  else text = String(e?.type ?? 'Änderung');
                  const wer = e?.deviceId && e.deviceId === deviceId ? 'Dieses Gerät' : 'Anderes Gerät';
                  return (
                    <div key={e?.eventId ?? Math.random()} className="cg-master-card-small !p-3">
                      <div className="typo-card-title">{text}</div>
                      <div className="typo-body-dim text-[var(--text-tertiary)]">
                        {wer} · {new Date(log.recordedAt).toLocaleString('de-DE')}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-auto shrink-0">
                <button onClick={() => setShowHistory(false)} className="cg-master-button flex-1 !p-3">Schließen</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}