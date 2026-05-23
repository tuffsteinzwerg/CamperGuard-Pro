import React, { useState } from 'react';
import type { AppState } from '../../types';
import { Plus, Check, Edit2, Trash2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DepartureChecklistProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function DepartureChecklist({ state, setState }: DepartureChecklistProps) {
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");

  return (
    <>
      {/* Element 7: Abfahrt-Checkliste */}
      <div className="cg-panel p-4">
          <div 
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setIsChecklistOpen(!isChecklistOpen)}
          >
              <div className="typo-engraved">ABFAHRT-CHECKLISTE</div>
              <span className={`transition-transform duration-200 text-[#8a939c] ${isChecklistOpen ? 'rotate-180' : ''}`}>
                  <ChevronDown size={16} />
              </span>
          </div>
          {isChecklistOpen && (
              <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                  {(state.checklist || []).map((item: any) => {
                      return (
                          <div key={item.id} className="cg-inset py-2 flex items-center justify-between group hover:bg-black/20 transition-colors px-3 rounded border border-white/5">
                              {editingChecklistItemId === item.id ? (
                                  <div className="flex items-center gap-2 flex-1 w-full">
                                      <input
                                          type="text"
                                          value={editingChecklistText}
                                          onChange={(e) => setEditingChecklistText(e.target.value)}
                                          className="cg-master-input flex-1 py-1 bg-black/50 border-white/10"
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter' && editingChecklistText.trim() !== '') {
                                                  const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, label: editingChecklistText.trim()} : c);
                                                  setState({...state, checklist: nc});
                                                  setEditingChecklistItemId(null);
                                              } else if (e.key === 'Escape') {
                                                  setEditingChecklistItemId(null);
                                              }
                                          }}
                                          autoFocus
                                      />
                                      <button 
                                          onClick={() => {
                                              if(editingChecklistText.trim() !== '') {
                                                  const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, label: editingChecklistText.trim()} : c);
                                                  setState({...state, checklist: nc});
                                                  setEditingChecklistItemId(null);
                                              }
                                          }}
                                          className="cg-master-button !p-2 !rounded flex-shrink-0"
                                      >
                                          <Check size={16} />
                                      </button>
                                      <button onClick={() => setEditingChecklistItemId(null)} className="cg-master-button !p-2 !rounded flex-shrink-0">X</button>
                                  </div>
                              ) : (
                                  <>
                                      <div onClick={() => {
                                              const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, checked: !c.checked} : c);
                                              setState({...state, checklist: nc});
                                          }}
                                          className="flex items-center gap-3 cursor-pointer flex-1 py-1"
                                      >
                                          <div className={`w-[18px] h-[18px] border-2 flex-shrink-0 border-[var(--accent)] rounded-sm relative flex items-center justify-center transition-colors ${item.checked ? 'bg-[var(--accent)]' : 'bg-transparent'}`}>
                                               {item.checked && <Check size={14} className="text-black" />}
                                          </div>
                                          <span className={`typo-body ${item.checked ? 'opacity-40 line-through' : ''}`}>{item.label}</span>
                                      </div>
                                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={(e) => { e.stopPropagation(); setEditingChecklistText(item.label); setEditingChecklistItemId(item.id); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14}/></button>
                                          <button onClick={(e) => { e.stopPropagation(); setState({...state, checklist: state.checklist.filter((c:any) => c.id !== item.id)}); }} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14}/></button>
                                      </div>
                                  </>
                              )}
                          </div>
                      );
                  })}
                  <div className="cg-inset py-2 flex items-center gap-2 px-3 rounded border border-white/5">
                      <input 
                          type="text" 
                          placeholder="Neuer Eintrag..." 
                          value={newChecklistItem} 
                          onChange={(e) => setNewChecklistItem(e.target.value)} 
                          className="cg-master-input flex-1 bg-black/50 border-white/10"
                          onKeyDown={(e) => {
                              if (e.key === 'Enter' && newChecklistItem.trim() !== '') {
                                  const n = { id: Date.now().toString(), label: newChecklistItem.trim(), checked: false };
                                  setState({...state, checklist: [...(state.checklist || []), n]});
                                  setNewChecklistItem("");
                              }
                          }}
                      />
                      <button 
                          onClick={() => {
                              if (newChecklistItem.trim() !== '') {
                                  const n = { id: Date.now().toString(), label: newChecklistItem.trim(), checked: false };
                                  setState({...state, checklist: [...(state.checklist || []), n]});
                                  setNewChecklistItem("");
                              }
                          }} 
                          className="cg-master-button !p-2 !rounded flex-shrink-0"
                      >
                          <Plus size={16} />
                      </button>
                  </div>
              </div>
          )}
      </div>
    </>
  );
}
