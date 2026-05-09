const fs = require('fs');
let code = fs.readFileSync('src/views/ReiseView.tsx', 'utf8');

// Step 1: Add new Refs
const refsTarget = `  const lastSpokenDirectionRef = useRef<string>('level');
  const audioModeRef = useRef<string>('tone');`;
const refsReplace = `  const lastSpokenDirectionRef = useRef<string>('level');
  const prevTiltRef = useRef<number>(99);
  const prevRingRef = useRef<number>(5);
  const lastSpeakTimeRef = useRef<number>(0);
  const audioModeRef = useRef<string>('tone');`;
code = code.replace(refsTarget, refsReplace);

// Step 2: Replace speakDirection
const speakDirectionTargetStart = `  const speakDirection = (direction: string) => {`;
const speakDirectionTargetEnd = `  const schedulePulse = () => {`;
const speakDirectionStr = code.substring(code.indexOf(speakDirectionTargetStart), code.indexOf(speakDirectionTargetEnd));

const newSpeakDirection = `  // === VIRTUELLER EINWEISER ===

  const speak = (text: string) => {
      try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'de-DE';
          utterance.rate = 1.4;
          utterance.volume = 0.9;
          window.speechSynthesis.speak(utterance);
      } catch (e) {}
      lastSpeakTimeRef.current = Date.now();
  };

  const directionLabels: Record<string, string> = {
      'front': 'vorne',
      'rear': 'hinten',
      'left': 'links',
      'right': 'rechts',
      'frontLeft': 'vorne links',
      'frontRight': 'vorne rechts',
      'rearLeft': 'hinten links',
      'rearRight': 'hinten rechts'
  };

  const getTiltRing = (tilt: number): number => {
      if (tilt > 6) return 5;
      if (tilt > 4) return 4;
      if (tilt > 2) return 3;
      if (tilt > 1) return 2;
      if (tilt > 0.5) return 1;
      return 0; // Level
  };

  const handleVoiceFeedback = (direction: string, tiltTotal: number) => {
      const prevRing = prevRingRef.current;
      const currentRing = getTiltRing(tiltTotal);
      const now = Date.now();

      // --- Level erreicht ---
      if (direction === 'level' || currentRing === 0) {
          if (lastSpokenDirectionRef.current !== 'level') {
              speak('passt!');
          }
          lastSpokenDirectionRef.current = 'level';
          prevTiltRef.current = 0;
          prevRingRef.current = 0;
          return;
      }

      // --- Richtungswechsel: Neue Richtung ansagen ---
      if (direction !== lastSpokenDirectionRef.current) {
          const label = directionLabels[direction];
          if (label) {
              // War vorher schon aktiv? Dann war es eine Überkorrektur
              if (lastSpokenDirectionRef.current !== 'level') {
                  speak('nee, jetzt ' + label + ' zu hoch');
              } else {
                  // Erstansage
                  speak(label + ' zu hoch');
              }
          }
          lastSpokenDirectionRef.current = direction;
          prevTiltRef.current = tiltTotal;
          prevRingRef.current = currentRing;
          return;
      }

      // --- Ring-Übergang prüfen (gleiche Richtung) ---
      if (currentRing !== prevRing) {
          if (currentRing < prevRing) {
              // Ring nach innen = besser
              if (currentRing === 1) {
                  speak('fast');
              } else if (currentRing === 2) {
                  speak('gleich');
              } else {
                  speak('gut');
              }
          } else {
              // Ring nach außen = schlechter
              speak('nee');
          }
          prevRingRef.current = currentRing;
          prevTiltRef.current = tiltTotal;
          return;
      }

      // --- Wiederholungsansage: Wenn 1,5s lang nichts passiert ist ---
      if (now - lastSpeakTimeRef.current > 1500) {
          const label = directionLabels[direction];
          if (label) {
              speak('immer noch ' + label + ' zu hoch');
          }
      }

      prevTiltRef.current = tiltTotal;
  };

`;

code = code.replace(speakDirectionStr, newSpeakDirection);

// Error check before step 3 & 4 because replace didn't work previously due to slightly different text.
const schedulePulseStr = code.substring(code.indexOf(`  const schedulePulse = () => {`), code.indexOf(`  const stopPulses = () => {`));

// Step 4: Level-Erreichen (replace within schedulePulseStr to be safe)
const levelTarget = schedulePulseStr.match(/      \/\/ Lock-Akkord bei Level-Erreichen[\s\S]*?wasLevelRef\.current = false;\s*?\}/)[0];

const levelReplace = `      // Lock-Akkord + Sprache bei Level-Erreichen (in allen Modi)
      if (isLevel && !wasLevelRef.current) {
          playLockChord();
          if (mode === 'speech+tone' || mode === 'speech') {
              speak('passt!');
          }
          lastSpokenDirectionRef.current = 'level';
          prevTiltRef.current = 0;
          prevRingRef.current = 0;
          wasLevelRef.current = true;
      } else if (!isLevel) {
          wasLevelRef.current = false;
      }`;
code = code.replace(levelTarget, levelReplace);


// Step 3: schedulePulse bottom part
const pulseBottomTarget = `      // Panner-Position aktualisieren (für Ton-Modi)
      updatePannerPosition();

      // tiltTotal berechnen (wird für Einweiser UND Intervall gebraucht)
      const tiltTotal = Math.sqrt(pitch * pitch + roll * roll);

      // Einweiser-Sprachfeedback (für Sprache-Modi)
      if (mode === 'speech+tone' || mode === 'speech') {
          handleVoiceFeedback(latestDirectionRef.current, tiltTotal);
      }

      // Pulse abspielen (für Ton-Modi)
      if (mode === 'tone' || mode === 'speech+tone') {
          playPulse();
      }

      // Intervall berechnen: 800ms bei 1° → 80ms bei 10°
      const clampedTilt = Math.max(0.5, Math.min(10, tiltTotal));
      const interval = 800 - ((clampedTilt - 0.5) / 9.5) * 720;

      // Im reinen Sprache-Modus langsamer prüfen (Sprache braucht Zeit)
      const checkInterval = mode === 'speech' ? Math.max(interval, 400) : interval;

      pulseTimerRef.current = setTimeout(schedulePulse, checkInterval);`;

const pulseBottomReplace = `      // Panner-Position aktualisieren (für Ton-Modi)
      updatePannerPosition();

      // tiltTotal berechnen (wird für Einweiser UND Intervall gebraucht)
      const tiltTotal = Math.sqrt(pitch * pitch + roll * roll);

      // Einweiser-Sprachfeedback (für Sprache-Modi)
      if (mode === 'speech+tone' || mode === 'speech') {
          handleVoiceFeedback(latestDirectionRef.current, tiltTotal);
      }

      // Pulse abspielen (für Ton-Modi)
      if (mode === 'tone' || mode === 'speech+tone') {
          playPulse();
      }

      // Intervall berechnen (INVERTIERT): 80ms bei 0.5° (nah) → 800ms bei 10° (weit)
      // Je näher an der Mitte, desto schneller die Pulse — wie ein Einparksensor
      const clampedTilt = Math.max(0.5, Math.min(10, tiltTotal));
      const interval = 80 + ((clampedTilt - 0.5) / 9.5) * 720;

      // Im reinen Sprache-Modus langsamer prüfen (Sprache braucht Zeit)
      const checkInterval = mode === 'speech' ? Math.max(interval, 400) : interval;

      pulseTimerRef.current = setTimeout(schedulePulse, checkInterval);`;

code = code.replace(pulseBottomTarget, pulseBottomReplace);


// Step 5: stopPulses
const stopPulsesTarget = `  const stopPulses = () => {
      if (pulseTimerRef.current) {
          clearTimeout(pulseTimerRef.current);
          pulseTimerRef.current = null;
      }
      pannerRef.current = null;
      lastSpokenDirectionRef.current = 'level';
      prevTiltRef.current = 99;
      prevRingRef.current = 5;
      try { window.speechSynthesis.cancel(); } catch(e) {}
  };`;

const stopPulsesReplace = `  const stopPulses = () => {
      if (pulseTimerRef.current) {
          clearTimeout(pulseTimerRef.current);
          pulseTimerRef.current = null;
      }
      pannerRef.current = null;
      lastSpokenDirectionRef.current = 'level';
      prevTiltRef.current = 99;
      prevRingRef.current = 5;
      lastSpeakTimeRef.current = 0;
      try { window.speechSynthesis.cancel(); } catch(e) {}
  };`;
code = code.replace(stopPulsesTarget, stopPulsesReplace);


fs.writeFileSync('src/views/ReiseView.tsx', code);
console.log('Update absolute success!');
