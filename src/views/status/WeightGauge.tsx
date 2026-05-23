import React from 'react';
import { formatNumber, formatWeight } from '../../lib/formatters';
import { Scale, CheckCircle, AlertTriangle } from 'lucide-react';

interface WeightGaugeProps {
  totalWeight: number;
  remainingWeight: number;
  state: any;
  setState: any;
  waterWeightImpact: number;
  wasteWaterWeight: number;
  dieselWeight: number;
  inventoryWeight: number;
}

export function WeightGauge({ totalWeight, remainingWeight, state, setState, waterWeightImpact, wasteWaterWeight, dieselWeight, inventoryWeight }: WeightGaugeProps) {
  const overLbs = remainingWeight < 0 ? Math.abs(remainingWeight) : 0;

  return (
    <>
      {/* Element 3: Gewichts-Hero-Anzeige */}
      <div className="cg-panel relative overflow-hidden p-6 z-0">
        {/* Deep Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)] pointer-events-none z-0" />

        {/* Subtle technical background structure */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.03),transparent_50%)] pointer-events-none" />
        
        {/* Premium Metallic Screws (Panel Corners) */}
        <div className="absolute top-3 left-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute top-3 right-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute bottom-3 left-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute bottom-3 right-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>

        <div className="text-[13px] text-[#8a939c] font-bold tracking-[0.3em] mb-8 text-center relative z-10 uppercase" style={{ textShadow: '0 -2px 2px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.08), 0 0 4px rgba(0,0,0,0.6)' }}>GESAMTGEWICHT</div>
        
        <div className="flex flex-col items-center gap-6 relative z-10">

          {/* Instrument Recess (Mulde) */}
          <div className="relative w-[280px] h-[280px] flex items-center justify-center bg-gradient-to-b from-[#08090a] to-[#16181b] rounded-full shadow-[inset_0_12px_24px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90 shrink-0">
              
              {/* Actual Compass Outer Ring */}
              <div className="absolute w-[260px] h-[260px] rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_10px_30px_rgba(0,0,0,0.9),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-2px_8px_rgba(0,0,0,0.8)] border border-[#000] z-0 pointer-events-none" />
              
              {/* Inner Bevel of the ring */}
              <div className="absolute w-[214px] h-[214px] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_4px_10px_rgba(0,0,0,0.9)] z-0 pointer-events-none border border-black/80" />

              {/* Inner Compass Glass Face */}
              <div className="absolute w-[210px] h-[210px] flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_15px_30px_rgba(0,0,0,0.95)] overflow-hidden z-10">
                  {/* Glass highlight top */}
                  <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/5 to-transparent rounded-[100%] pointer-events-none" />
                  
                  {/* Status Glow Bottom & Icon */}
                  {(() => {
                      const ratio = totalWeight / (state.profile.maxWeight || 3500);
                      const glowColor = ratio > 1 ? '#ff3b30' : ratio > 0.9 ? '#ffcc00' : '#00ff9c';
                      return (
                          <>
                              <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${glowColor} 0%, transparent 70%)` }} />
                              <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: glowColor, boxShadow: `0 -2px 8px ${glowColor}` }} />
                              <div className="absolute bottom-[22px] left-1/2 -translate-x-1/2 pointer-events-none" style={{ color: glowColor, filter: `drop-shadow(0 0 4px ${glowColor}80)` }}>
                                  <Scale size={18} />
                              </div>
                          </>
                      );
                  })()}
                  
                  {/* Grid lines */}
                  <div className="absolute w-[1px] h-full bg-gradient-to-b from-transparent via-[#10b981]/60 to-transparent left-1/2 -translate-x-1/2" />
                  <div className="absolute h-[1px] w-full bg-gradient-to-r from-transparent via-[#10b981]/60 to-transparent top-1/2 -translate-y-1/2" />
                  
                  {/* Inner technical rings */}
                  <div className="absolute w-[140px] h-[140px] rounded-full border border-[#10b981]/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]" />
                  <div className="absolute w-[80px] h-[80px] rounded-full border border-[#10b981]/15 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]" />
                  
                  {/* Center glowing radar circle */}
                  <div className="absolute w-[36px] h-[36px] rounded-full border border-[#10b981]/50 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.35)_0%,_transparent_70%)] shadow-[0_0_30px_rgba(16,185,129,0.5),_inset_0_0_15px_rgba(16,185,129,0.3)]" />
              </div>

              {/* Compass marks mounted on the Ring (z-20 so it sits freely above the inner face but inside the 260 box) */}
              <div className="absolute z-20 w-[254px] h-[254px] pointer-events-none">
                {[...Array(72)].map((_, i) => {
                  const deg = i * 5;
                  const isCardinal = deg % 90 === 0;
                  const isOrdinal = deg % 45 === 0 && !isCardinal;
                  const isTen = deg % 10 === 0 && !isCardinal;
                  
                  return (
                    <div 
                      key={i} 
                      className="absolute inset-0 flex justify-center z-10 pointer-events-none"
                      style={{ transform: `rotate(${deg}deg)` }}
                    >
                      {!isCardinal && isOrdinal && <div className="mt-[4px] w-[2.5px] h-[8px] bg-[#ff6600] rounded-sm shadow-[0_0_6px_rgba(255,102,0,0.7)]" />}
                      {!isCardinal && !isOrdinal && isTen && <div className="mt-[5px] w-[2px] h-[6px] bg-[#888] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                      {!isCardinal && !isOrdinal && !isTen && <div className="mt-[6px] w-[1px] h-[4px] bg-[#555] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                    </div>
                  );
                })}
              </div>

              {/* Center Weight Display */}
              <div className="absolute z-30 flex flex-col items-center justify-center">
                  <button
                      onClick={() => setState({...state, sos: {...state.sos, gpsEnabled: state.sos.gpsEnabled === false ? true : false}})}
                      className="flex items-center gap-1.5 mb-4 -mt-8 pointer-events-auto"
                  >
                      <div className={`w-[7px] h-[7px] rounded-full ${state.sos.gpsEnabled !== false ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.5)]' : 'bg-[var(--accent)] shadow-[0_0_6px_rgba(255,102,0,0.4)]'}`} />
                      <span className={`text-[10px] font-bold tracking-[0.15em] uppercase ${state.sos.gpsEnabled !== false ? 'text-[#00ff9c]/80' : 'text-[var(--accent)]/80'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>GPS</span>
                  </button>
                  <div className="relative flex items-baseline justify-center pointer-events-none" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                      <span className={`instrument-value text-5xl tracking-normal ${
                          (totalWeight / (state.profile.maxWeight || 3500)) > 1 ? 'instrument-value-danger' :
                          (totalWeight / (state.profile.maxWeight || 3500)) > 0.9 ? 'instrument-value-warning' :
                          'instrument-value-success'
                      }`}>
                          {Math.round(totalWeight)}
                      </span>
                      <div className="w-0">
                          <span className="instrument-value text-base opacity-40 ml-2">kg</span>
                      </div>
                  </div>
                  
                  <div className="text-[10px] uppercase font-bold tracking-widest text-[#666] mt-1 relative z-10" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                      Max {formatNumber(state.profile.maxWeight || 3500, 0)} kg
                  </div>
              </div>
          </div>
          <div className="flex w-full pt-5 border-t border-white/5 relative cg-inset">
              {remainingWeight >= 0 ? (
                  <div className="flex items-center justify-center gap-2 w-full text-[#00ff9c]">
                      <CheckCircle size={20} className="filter drop-shadow-[0_0_8px_rgba(0,255,156,0.3)]" />
                      <div className="flex flex-col items-start leading-tight">
                         <span className="instrument-value-success text-[11px] font-bold tracking-widest uppercase">IM SICHEREN BEREICH</span>
                         <span className="cg-technical-label text-white/40 mt-0.5">noch {formatNumber(remainingWeight, 0)} kg frei</span>
                      </div>
                  </div>
              ) : (
                  <div className="flex items-center justify-center gap-2 w-full text-[var(--status-danger)] animate-pulse">
                      <AlertTriangle size={20} className="filter drop-[var(--status-danger)]" />
                      <div className="flex flex-col items-start leading-tight">
                         <span className="instrument-value-danger text-[11px] font-bold tracking-widest uppercase">ÜBERLADEN</span>
                         <span className="cg-technical-label text-[#ff3b30]/80 mt-0.5">{formatNumber(Math.abs(remainingWeight), 0)} kg zu viel</span>
                      </div>
                  </div>
              )}
          </div>
        </div>
      </div>

      {/* Element 5: Gewichtsaufschlüsselung */}
      <div className="cg-panel p-4">
          <div className="typo-engraved mb-4">GEWICHTSAUFSCHLÜSSELUNG</div>
          <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Leergewicht</span>
                  <span className="instrument-value text-sm">{formatNumber(state.profile.emptyWeight || 0, 0)} kg</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Frischwasser</span>
                  <span className="instrument-value text-sm text-blue-400">+ {formatWeight(waterWeightImpact)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Abwasser</span>
                  <span className="instrument-value text-sm text-gray-400">+ {formatWeight(wasteWaterWeight)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Diesel</span>
                  <span className="instrument-value text-sm text-orange-400">+ {formatWeight(dieselWeight)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Inventar</span>
                  <span className="instrument-value text-sm">+ {formatWeight(inventoryWeight)}</span>
              </div>
          </div>
          <hr className="divider my-4" />
          <div className="flex justify-between items-end">
              <span className="cg-technical-label">Gesamtgewicht</span>
              <div className="flex items-baseline gap-1">
                  <span className="instrument-value text-2xl">{formatNumber(totalWeight, 0)}</span>
                  <span className="instrument-value text-sm">kg</span>
              </div>
          </div>
      </div>
    </>
  );
}
