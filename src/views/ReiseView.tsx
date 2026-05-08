import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { motion } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

let globalLeafletMap: L.Map | null = null;

const MapHandlerComponent = ({ destination, setDestination, setDistance, range }: { destination: [number, number] | null, setDestination: (d: [number, number]) => void, setDistance: (d: number) => void, range: number }) => {
  useMapEvents({
    click(e) {
      setDestination([e.latlng.lat, e.latlng.lng]);
      setDistance(Math.floor(Math.random() * (range * 0.8)) + 50); // dummy dist
    },
  });
  return destination ? <Marker position={destination} /> : null;
};

const ResizeMapComponent = () => {
  const map = useMap();
  useEffect(() => {
    globalLeafletMap = map;
    return () => { globalLeafletMap = null; };
  }, [map]);
  return null;
};

export function ReiseView({ state, setState, orientation, orientationPermission, requestOrientationPermission }: any) {
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isAudioAssistActive, setIsAudioAssistActive] = useState(false);
  const [audioMode, setAudioMode] = useState<'tone' | 'speech+tone' | 'speech'>('tone');
  const [soundTestIndex, setSoundTestIndex] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const latestDirectionRef = useRef<string>('level');
  const latestIntensityRef = useRef<number>(0);
  const wasLevelRef = useRef<boolean>(false);
  const pannerRef = useRef<PannerNode | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calibratedPitchRef = useRef<number>(0);
  const calibratedRollRef = useRef<number>(0);
  const lastSpokenDirectionRef = useRef<string>('level');
  const audioModeRef = useRef<string>('tone');

  const calibratedPitch = (orientation?.pitch || 0) - (state.profile.pitchOffset || 0);
  const calibratedRoll = (orientation?.roll || 0) - (state.profile.rollOffset || 0);
  calibratedPitchRef.current = calibratedPitch;
  calibratedRollRef.current = calibratedRoll;
  audioModeRef.current = audioMode;

  const pitchNormalized = Math.max(-20, Math.min(20, calibratedPitch));
  const rollNormalized = Math.max(-20, Math.min(20, calibratedRoll));
  const heading = orientation?.heading || 0;

  // Audio Level Assist - Internes Richtungsmodell (welche Seite muss angehoben werden)
  const deadzone = 0.5;
  let assistDirection = 'level';
  const needRaiseFront = calibratedPitch > deadzone;
  const needRaiseRear = calibratedPitch < -deadzone;
  const needRaiseRight = calibratedRoll > deadzone;
  const needRaiseLeft = calibratedRoll < -deadzone;

  if (needRaiseFront && needRaiseLeft) assistDirection = 'rearRight';
  else if (needRaiseFront && needRaiseRight) assistDirection = 'rearLeft';
  else if (needRaiseRear && needRaiseLeft) assistDirection = 'frontRight';
  else if (needRaiseRear && needRaiseRight) assistDirection = 'frontLeft';
  else if (needRaiseFront) assistDirection = 'rear';
  else if (needRaiseRear) assistDirection = 'front';
  else if (needRaiseLeft) assistDirection = 'right';
  else if (needRaiseRight) assistDirection = 'left';

  const tiltIntensity = Math.sqrt(calibratedPitch * calibratedPitch + calibratedRoll * calibratedRoll);

  latestDirectionRef.current = assistDirection;
  latestIntensityRef.current = tiltIntensity;

// === KONTINUIERLICHE SONIFIKATION (Tiltification-Prinzip) ===

  const playLockChord = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const now = ctx.currentTime;
      const chordGain = ctx.createGain();
      chordGain.gain.setValueAtTime(0.25, now);
      chordGain.connect(ctx.destination);
      [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          const t = now + i * 0.03;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.2, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
          osc.connect(g);
          g.connect(chordGain);
          osc.start(t);
          osc.stop(t + 0.85);
      });
  };

// === HRTF 3D AUDIO LEVEL-ASSIST ===

  const initPanner = () => {
      const ctx = audioCtxRef.current;
      if (!ctx || pannerRef.current) return;

      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.maxDistance = 10;
      panner.rolloffFactor = 1;
      panner.coneInnerAngle = 360;
      panner.coneOuterAngle = 0;
      panner.coneOuterGain = 0;
      panner.connect(ctx.destination);
      pannerRef.current = panner;

      // Listener im Ursprung, schaut in -z Richtung (Web Audio Standard)
      if (ctx.listener.positionX) {
          ctx.listener.positionX.setValueAtTime(0, ctx.currentTime);
          ctx.listener.positionY.setValueAtTime(0, ctx.currentTime);
          ctx.listener.positionZ.setValueAtTime(0, ctx.currentTime);
          ctx.listener.forwardX.setValueAtTime(0, ctx.currentTime);
          ctx.listener.forwardY.setValueAtTime(0, ctx.currentTime);
          ctx.listener.forwardZ.setValueAtTime(-1, ctx.currentTime);
          ctx.listener.upX.setValueAtTime(0, ctx.currentTime);
          ctx.listener.upY.setValueAtTime(1, ctx.currentTime);
          ctx.listener.upZ.setValueAtTime(0, ctx.currentTime);
      } else {
          // Fallback für ältere Browser
          ctx.listener.setPosition(0, 0, 0);
          ctx.listener.setOrientation(0, 0, -1, 0, 1, 0);
      }
  };

  const updatePannerPosition = () => {
      const panner = pannerRef.current;
      const ctx = audioCtxRef.current;
      if (!panner || !ctx) return;

      const dz = 0.5; // deadzone
      const pitch = calibratedPitchRef.current;
      const roll = calibratedRollRef.current;

      // Innerhalb der Deadzone: Tonquelle im Kopf (kein Puls wird abgespielt)
      if (Math.abs(pitch) <= dz && Math.abs(roll) <= dz) return;

      // Roll → x-Achse (rechts zu hoch → Ton rechts)
      // Pitch → z-Achse (vorne zu hoch → Ton vorne, hinten zu hoch → Ton hinten)
      // HRTF z-Achse: negativ = vor dem Hörer, positiv = hinter dem Hörer
      let rawX = Math.max(-1, Math.min(1, -roll / 10));
      let rawZ = Math.max(-1, Math.min(1, pitch / 10)); // inveriert: Ton dahin wo unterlegt werden muss

      // Auf Einheitskreis clampen (damit Diagonalen nicht lauter sind)
      const dist = Math.sqrt(rawX * rawX + rawZ * rawZ);
      if (dist > 1) {
          rawX /= dist;
          rawZ /= dist;
      }

      // Position setzen (y=0, auf Ohrhöhe)
      if (panner.positionX) {
          panner.positionX.setValueAtTime(rawX, ctx.currentTime);
          panner.positionY.setValueAtTime(0, ctx.currentTime);
          panner.positionZ.setValueAtTime(rawZ, ctx.currentTime);
      } else {
          panner.setPosition(rawX, 0, rawZ);
      }
  };

  const playPulse = () => {
      const ctx = audioCtxRef.current;
      const panner = pannerRef.current;
      if (!ctx || !panner) return;

      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';

      // Tonhöhe variiert mit Neigungsrichtung und -stärke
      // Hinten unterlegen nötig (pitch < 0): hoher Ton (bis 900 Hz)
      // Vorne unterlegen nötig (pitch > 0): tiefer Ton (bis 400 Hz)
      // Level (pitch ≈ 0): Mittelton (660 Hz)
      const pitch = calibratedPitchRef.current;
      const pitchClamped = Math.max(-10, Math.min(10, pitch));
      const freq = 660 + (pitchClamped / 10) * -260;
      osc.frequency.setValueAtTime(freq, now);

      // Kurze Hüllkurve: 5ms Attack, 55ms Release = 60ms total
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(panner);

      osc.start(now);
      osc.stop(now + 0.07);
  };

  const speakDirection = (direction: string) => {
      if (direction === lastSpokenDirectionRef.current) return;
      if (direction === 'level') {
          lastSpokenDirectionRef.current = 'level';
          return;
      }
      lastSpokenDirectionRef.current = direction;

      const labels: Record<string, string> = {
          'front': 'vorne',
          'rear': 'hinten',
          'left': 'links',
          'right': 'rechts',
          'frontLeft': 'vorne links',
          'frontRight': 'vorne rechts',
          'rearLeft': 'hinten links',
          'rearRight': 'hinten rechts'
      };

      const text = labels[direction];
      if (!text) return;

      try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'de-DE';
          utterance.rate = 1.3;
          utterance.volume = 0.8;
          window.speechSynthesis.speak(utterance);
      } catch (e) {}
  };

  const schedulePulse = () => {
      const pitch = calibratedPitchRef.current;
      const roll = calibratedRollRef.current;
      const dz = 0.5;
      const mode = audioModeRef.current;

      const isLevel = Math.abs(pitch) <= dz && Math.abs(roll) <= dz;

      // Lock-Akkord bei Level-Erreichen (in allen Modi)
      if (isLevel && !wasLevelRef.current) {
          playLockChord();
          lastSpokenDirectionRef.current = 'level';
          wasLevelRef.current = true;
      } else if (!isLevel) {
          wasLevelRef.current = false;
      }

      // Kein Puls und keine Sprache im Level
      if (isLevel) {
          pulseTimerRef.current = setTimeout(schedulePulse, 200);
          return;
      }

      // Panner-Position aktualisieren (für Ton-Modi)
      updatePannerPosition();

      // Sprachansage bei Richtungswechsel (für Sprache-Modi)
      if (mode === 'speech+tone' || mode === 'speech') {
          speakDirection(latestDirectionRef.current);
      }

      // Pulse abspielen (für Ton-Modi)
      if (mode === 'tone' || mode === 'speech+tone') {
          playPulse();
      }

      // Intervall berechnen: 800ms bei 1° → 80ms bei 10°
      const tiltTotal = Math.sqrt(pitch * pitch + roll * roll);
      const clampedTilt = Math.max(0.5, Math.min(10, tiltTotal));
      const interval = 800 - ((clampedTilt - 0.5) / 9.5) * 720;

      // Im reinen Sprache-Modus langsamer prüfen (Sprache braucht Zeit)
      const checkInterval = mode === 'speech' ? Math.max(interval, 400) : interval;

      pulseTimerRef.current = setTimeout(schedulePulse, checkInterval);
  };

  const stopPulses = () => {
      if (pulseTimerRef.current) {
          clearTimeout(pulseTimerRef.current);
          pulseTimerRef.current = null;
      }
      pannerRef.current = null;
      lastSpokenDirectionRef.current = 'level';
      try { window.speechSynthesis.cancel(); } catch(e) {}
  };

  // --- useEffect: HRTF Audio starten/stoppen ---
  useEffect(() => {
      if (isAudioAssistActive && audioCtxRef.current) {
          initPanner();
          schedulePulse();
      }
      return () => {
          stopPulses();
      };
  }, [isAudioAssistActive]);

  const handleTaraReset = () => {
      setState((prev: any) => ({ ...prev, profile: { ...prev.profile, pitchOffset: 0, rollOffset: 0 } }));
  };

  const handleAudioToggle = async () => {
      if (!isAudioAssistActive) {
          // Aus → Ton (erstes Einschalten)
          try {
              if (!audioCtxRef.current) {
                  audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              }
              if (audioCtxRef.current.state === 'suspended') {
                  await audioCtxRef.current.resume();
              }

              // Ready-Testton
              const ctx = audioCtxRef.current;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              gain.gain.setValueAtTime(0, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.5);

              setAudioMode('tone');
              setIsAudioAssistActive(true);
          } catch (e) {
              console.warn("AudioContext creation failed:", e);
          }
      } else {
          // Durchschalten: Ton → Sprache+Ton → Sprache → Aus
          if (audioMode === 'tone') {
              setAudioMode('speech+tone');
          } else if (audioMode === 'speech+tone') {
              setAudioMode('speech');
          } else {
              // Sprache → Aus
              setIsAudioAssistActive(false);
              setAudioMode('tone');
          }
      }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      // @ts-ignore
      if(globalLeafletMap) globalLeafletMap.invalidateSize({debounce: false});
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const avgConsumption = useMemo(() => {
    if (state.fuelLog.length < 2) return 11.5;
    const sorted = [...state.fuelLog].sort((a,b) => b.km - a.km);
    const totalDist = sorted[0].km - sorted[sorted.length - 1].km;
    const totalLiters = sorted.slice(0, -1).reduce((acc:number, curr:any) => acc + curr.liters, 0);
    return totalDist > 0 ? (totalLiters / totalDist) * 100 : 11.5;
  }, [state.fuelLog]);

  const range = ((state.profile.dieselCapacity || 80) / avgConsumption) * 100;

  const isCritical = distance ? distance > range : false;

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-140px)]">
      {orientationPermission === 'prompt' && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--accent)]/30">
          <p className="text-sm text-gray-300 mb-3">
            Um Kompass und Wasserwaage nutzen zu können, wird Zugriff auf die Bewegungssensoren benötigt.
          </p>
          <button 
            onClick={requestOrientationPermission}
            className="w-full py-2 px-4 rounded-lg bg-[var(--accent)] text-white font-bold text-sm"
          >
            Sensoren aktivieren
          </button>
        </div>
      )}
      
      <div className="relative overflow-hidden p-6 z-0 rounded-xl bg-gradient-to-b from-[#1c1e22] to-[#0e1013] shadow-[0_10px_30px_rgba(0,0,0,0.8),_inset_0_1px_1px_rgba(255,255,255,0.02)] border border-[#000]">
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

        <div className="text-[13px] text-[#8a939c] font-bold tracking-[0.3em] mb-8 text-center relative z-10 uppercase" style={{ textShadow: '0 -2px 2px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.08), 0 0 4px rgba(0,0,0,0.6)' }}>LAGE & KOMPASS</div>
        
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
              <div 
                className="absolute z-20 w-[254px] h-[254px] transition-transform duration-500 ease-out" 
                style={{ transform: `rotate(${-heading || 0}deg)` }}
              >
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
                      {deg === 0 && <div className="mt-[2px] font-black text-[16px] leading-none text-[#ff6600] drop-shadow-[0_0_8px_rgba(255,102,0,0.8)]">N</div>}
                      {deg === 90 && <div className="mt-[3px] font-black text-[13px] leading-none text-[#ccc] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">E</div>}
                      {deg === 180 && <div className="mt-[3px] font-black text-[13px] leading-none text-[#ccc] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">S</div>}
                      {deg === 270 && <div className="mt-[3px] font-black text-[13px] leading-none text-[#ccc] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">W</div>}
                      
                      {!isCardinal && isOrdinal && <div className="mt-[4px] w-[2.5px] h-[8px] bg-[#ff6600] rounded-sm shadow-[0_0_6px_rgba(255,102,0,0.7)]" />}
                      {!isCardinal && !isOrdinal && isTen && <div className="mt-[5px] w-[2px] h-[6px] bg-[#888] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                      {!isCardinal && !isOrdinal && !isTen && <div className="mt-[6px] w-[1px] h-[4px] bg-[#555] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                    </div>
                  );
                })}
              </div>

              {/* The Bubble (LED Sphere) - Z-30 */}
              {(() => {
                const rawBubbleX = -rollNormalized * 3.8;
                const rawBubbleY = -pitchNormalized * 3.8;
                const distance = Math.sqrt(rawBubbleX * rawBubbleX + rawBubbleY * rawBubbleY);
                const maxRadius = 88;
                
                let bubbleX = rawBubbleX;
                let bubbleY = rawBubbleY;
                
                if (distance > maxRadius) {
                  const scale = maxRadius / distance;
                  bubbleX *= scale;
                  bubbleY *= scale;
                }

                return (
                  <div className="absolute w-[210px] h-[210px] flex items-center justify-center rounded-full overflow-hidden z-30 pointer-events-none">
                    <motion.div 
                        className="absolute w-[36px] h-[36px] rounded-full overflow-hidden"
                        style={{
                          background: 'radial-gradient(circle at 35% 35%, #a7f3d0 0%, #34d399 25%, #059669 60%, #064e3b 100%)',
                          boxShadow: '0 10px 20px rgba(0,0,0,0.9), 0 0 25px rgba(16,185,129,0.7), inset 0 3px 6px rgba(255,255,255,0.9), inset 0 -6px 12px rgba(0,0,0,0.9), inset -2px -2px 8px rgba(110,231,183,0.6)',
                          border: '1px solid rgba(255,255,255,0.3)'
                        }}
                        animate={{ 
                          x: bubbleX,
                          y: bubbleY 
                        }}
                        transition={{ type: 'spring', stiffness: 70, damping: 18, mass: 0.8 }}
                    >
                        <div className="absolute top-[3px] left-[6px] w-[16px] h-[8px] bg-white/60 rounded-full rotate-[-40deg] blur-[1px] pointer-events-none" />
                        <div className="absolute top-[5px] left-[8px] w-[6px] h-[3px] bg-white rounded-full rotate-[-40deg] blur-[0.5px] pointer-events-none" />
                    </motion.div>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-row items-center justify-center mt-2 gap-8 w-full">
              {/* Box X (Roll) */}
              {(() => {
                const abs = Math.abs(rollNormalized);
                const val = abs <= 0.5 ? 0 : Math.round(abs);
                const valStyle = val === 0 ? {
                  color: '#00ff9c',
                  textShadow: '0 0 2px rgba(0,255,156,0.3)'
                } : {
                  color: '#ff8a2a',
                  textShadow: '0 0 2px rgba(255,138,42,0.3)'
                };
                return (
                  <div className="relative aspect-square w-[120px] rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                      <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                          <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                          <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${val === 0 ? '#00ff9c' : '#ff5a00'} 0%, transparent 70%)` }} />
                          <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: val === 0 ? '#00ff9c' : '#ff5a00', boxShadow: `0 -2px 8px ${val === 0 ? '#00ff9c' : '#ff5a00'}` }} />
                      </div>
                      <div className="absolute -top-5 w-full text-center z-40">
                          <div className="text-[10px] text-[#555] font-bold tracking-[0.2em] uppercase">HORIZONTAL</div>
                      </div>
                      <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-2">
                          <div className="flex items-baseline justify-center translate-x-[4px] mb-[2px]">
                              <span className="text-4xl leading-none font-mono font-bold" style={valStyle}>{val}</span>
                              <span className="text-[12px] text-[#444] ml-0.5">°</span>
                          </div>
                          <div style={{ color: val === 0 ? '#00ff9c' : '#ff5a00', filter: `drop-shadow(0 0 4px ${val === 0 ? '#00ff9c' : '#ff5a00'}80)` }}>
                              <ArrowLeftRight size={14} />
                          </div>
                      </div>
                  </div>
                );
              })()}

              {/* Box Y (Pitch) */}
              {(() => {
                const abs = Math.abs(pitchNormalized);
                const val = abs <= 0.5 ? 0 : Math.round(abs);
                const valStyle = val === 0 ? {
                  color: '#00ff9c',
                  textShadow: '0 0 2px rgba(0,255,156,0.3)'
                } : {
                  color: '#ff8a2a',
                  textShadow: '0 0 2px rgba(255,138,42,0.3)'
                };
                return (
                  <div className="relative aspect-square w-[120px] rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                      <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                          <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                          <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${val === 0 ? '#00ff9c' : '#ff5a00'} 0%, transparent 70%)` }} />
                          <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: val === 0 ? '#00ff9c' : '#ff5a00', boxShadow: `0 -2px 8px ${val === 0 ? '#00ff9c' : '#ff5a00'}` }} />
                      </div>
                      <div className="absolute -top-5 w-full text-center z-40">
                          <div className="text-[10px] text-[#555] font-bold tracking-[0.2em] uppercase">VERTIKAL</div>
                      </div>
                      <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-2">
                          <div className="flex items-baseline justify-center translate-x-[4px] mb-[2px]">
                              <span className="text-4xl leading-none font-mono font-bold" style={valStyle}>{val}</span>
                              <span className="text-[12px] text-[#444] ml-0.5">°</span>
                          </div>
                          <div style={{ color: val === 0 ? '#00ff9c' : '#ff5a00', filter: `drop-shadow(0 0 4px ${val === 0 ? '#00ff9c' : '#ff5a00'}80)` }}>
                              <ArrowUpDown size={14} />
                          </div>
                      </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="w-full flex justify-center gap-4 mt-6">
              <button
                onClick={() => setState({ ...state, profile: { ...state.profile, pitchOffset: orientation?.pitch || 0, rollOffset: orientation?.roll || 0 } })}
                className="cg-master-button"
                title="Aktuelle Position als waagerecht setzen"
              >
                TARA
              </button>
              <button
                onClick={handleAudioToggle}
                className="cg-master-button"
                title="Audio Level Assist aktivieren"
              >
                {!isAudioAssistActive ? 'AUDIO ASSIST' : audioMode === 'tone' ? 'TON' : audioMode === 'speech+tone' ? 'SPRACHE+TON' : 'SPRACHE'}
              </button>
              {(state.profile.pitchOffset !== 0 || state.profile.rollOffset !== 0) && (
                <button
                  onClick={handleTaraReset}
                  className="cg-master-button"
                  title="Tara-Kalibrierung zurücksetzen auf Werkseinstellung"
                >
                  TARA RESET
                </button>
              )}
            </div>

            {/* HÖHENKORREKTUR */}
            <div className="w-full flex justify-center">
              <div 
                className="w-full max-w-[280px] rounded-xl flex flex-col items-center justify-center p-5 relative cg-panel"
              >
                 <div className="text-[11px] cg-master-muted font-bold tracking-[0.25em] uppercase mb-6" style={{ textShadow: '0 -1px 1px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.05)' }}>Höhenkorrektur</div>
                 
                 <div className="w-full flex items-center justify-between relative px-2">
                    {/* Outline Camper */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[42px] h-[90px] border-2 border-[#999] rounded-t-[14px] rounded-b-[8px] opacity-80" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.05))' }}>
                         <div className="absolute top-[14px] left-[2px] right-[2px] h-[12px] border-2 border-[#999] rounded-[4px]" />
                    </div>

                    {(() => {
                      const getStyle = (val: number) => val === 0 ? {
                        color: '#00ff9c',
                        textShadow: '0 0 3px rgba(0,255,156,0.25)'
                      } : {
                        color: '#ff8a2a',
                        textShadow: '0 0 3px rgba(255,122,0,0.35)'
                      };
                      const tw = state.profile.trackWidth || 0;
                      const wb = state.profile.wheelbase || 0;
                      const hasHeightCorrectionDimensions = tw > 0 && wb > 0;
                      const rollRad = (calibratedRoll * Math.PI) / 180;
                      const pitchRad = (calibratedPitch * Math.PI) / 180;
                      
                      const sideCorrection = tw > 0 ? Math.abs(tw * Math.sin(rollRad)) : 0;
                      const sideLeft = calibratedRoll > deadzone ? Math.round(sideCorrection * 10) / 10 : 0;
                      const sideRight = calibratedRoll < -deadzone ? Math.round(sideCorrection * 10) / 10 : 0;
                      
                      const lengthCorrection = wb > 0 ? Math.abs(wb * Math.sin(pitchRad)) : 0;
                      const frontUp = calibratedPitch > deadzone ? Math.round(lengthCorrection * 10) / 10 : 0;
                      const rearUp = calibratedPitch < -deadzone ? Math.round(lengthCorrection * 10) / 10 : 0;
                      
                      const hFL = Math.round(Math.max(sideLeft + frontUp, 0) * 10) / 10;
                      const hHL = Math.round(Math.max(sideLeft + rearUp, 0) * 10) / 10;
                      const hFR = Math.round(Math.max(sideRight + frontUp, 0) * 10) / 10;
                      const hHR = Math.round(Math.max(sideRight + rearUp, 0) * 10) / 10;
                      const maxHeight = Math.max(hFL, hHL, hFR, hHR);
                      const vFL = Math.round(Math.max(maxHeight - hFL, 0));
                      const vHL = Math.round(Math.max(maxHeight - hHL, 0));
                      const vFR = Math.round(Math.max(maxHeight - hFR, 0));
                      const vHR = Math.round(Math.max(maxHeight - hHR, 0));
                      return (
                        <>
                          {hasHeightCorrectionDimensions ? (
                            <>
                              <div className="flex flex-col gap-6 text-left z-10">
                                 <div>
                                   <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Vorne Links</div>
                                   <div className="flex items-baseline">
                                     <span className="text-[24px] leading-none font-mono font-bold tabular-nums" style={getStyle(vFL)}>{vFL}</span>
                                     <span className="text-[12px] cg-master-muted ml-1">cm</span>
                                   </div>
                                 </div>
                                 <div>
                                   <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Hinten Links</div>
                                   <div className="flex items-baseline">
                                     <span className="text-[24px] leading-none font-mono font-bold tabular-nums" style={getStyle(vHL)}>{vHL}</span>
                                     <span className="text-[12px] cg-master-muted ml-1">cm</span>
                                   </div>
                                 </div>
                              </div>
                              
                              <div className="flex flex-col gap-6 text-right z-10">
                                 <div>
                                   <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Vorne Rechts</div>
                                   <div className="flex items-baseline justify-end">
                                     <span className="text-[24px] leading-none font-mono font-bold tabular-nums" style={getStyle(vFR)}>{vFR}</span>
                                     <span className="text-[12px] cg-master-muted ml-1">cm</span>
                                   </div>
                                 </div>
                                 <div>
                                   <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Hinten Rechts</div>
                                   <div className="flex items-baseline justify-end">
                                     <span className="text-[24px] leading-none font-mono font-bold tabular-nums" style={getStyle(vHR)}>{vHR}</span>
                                     <span className="text-[12px] cg-master-muted ml-1">cm</span>
                                   </div>
                                 </div>
                              </div>
                            </>
                          ) : ( <div className="cg-master-inset rounded-xl p-4 text-center"> <div className="cg-master-label !mb-1">Höhenkorrektur nicht verfügbar</div> <div className="cg-type-meta cg-master-muted">Bitte Spurbreite und Achsabstand im Profil eintragen.</div> </div> )}
                        </>
                      );
                    })()}
                 </div>
              </div>
            </div>

        </div>
      </div>

      <div className="relative overflow-hidden p-1.5 z-0 cg-panel">
        
        <style>{`
          .leaflet-control-attribution {
            background-color: rgba(0, 0, 0, 0.4) !important;
            color: #777 !important;
            font-size: 8px !important;
            backdrop-filter: blur(4px);
            border-top-left-radius: 6px;
            padding: 2px 6px !important;
          }
          .leaflet-control-attribution a {
            color: #999 !important;
            text-decoration: none !important;
          }
          .leaflet-control-attribution a:hover {
            color: #bbb !important;
          }
        `}</style>
        <div className="relative overflow-hidden z-0 h-[400px] w-full cg-inset">
            <MapContainer id="map" center={[51.1657, 10.4515]} zoom={6} zoomControl={false} style={{ height: '100%', width: '100%', background: '#0a0b0c' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <MapHandlerComponent destination={destination} setDestination={setDestination} setDistance={setDistance} range={range} />
              <ResizeMapComponent />
            </MapContainer>
        </div>
      </div>

    </div>
  );
}