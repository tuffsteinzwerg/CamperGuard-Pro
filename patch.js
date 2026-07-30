const fs = require('fs');
let content = fs.readFileSync('src/views/ReiseView.tsx', 'utf8');

content = content.replace(
  "const [audioMode, setAudioMode] = useState<'tone' | 'speech+tone' | 'speech'>('tone');",
  "const [audioMode, setAudioMode] = useState<'tone' | 'speech+tone' | 'speech'>('speech+tone');"
);

content = content.replace(
  "  const [soundTestIndex, setSoundTestIndex] = useState(0);\n",
  ""
);

content = content.replace(
  "const audioModeRef = useRef<string>('tone');",
  "const audioModeRef = useRef<string>('speech+tone');"
);

// We need to replace setAudioMode('tone') inside the try block of handleAudioToggle
// Let's find it. It's around line 509.
const einschaltStr = `
              setAudioMode('tone');
              setIsAudioAssistActive(true);`;
const einschaltRepl = `
              setAudioMode('speech+tone');
              setIsAudioAssistActive(true);`;
content = content.replace(einschaltStr, einschaltRepl);

const elseBlockStr = `          // Durchschalten: Ton → Sprache+Ton → Sprache → Aus
          if (audioMode === 'tone') {
              setAudioMode('speech+tone');
          } else if (audioMode === 'speech+tone') {
              setAudioMode('speech');
          } else {
              // Sprache → Aus
              setIsAudioAssistActive(false);
              setAudioMode('tone');
          }`;
const elseBlockRepl = `          // An → Aus
          setIsAudioAssistActive(false);`;
content = content.replace(elseBlockStr, elseBlockRepl);

content = content.replace(
  "chordGain.gain.setValueAtTime(0.25, now);",
  "chordGain.gain.setValueAtTime(0.5, now);"
);

fs.writeFileSync('src/views/ReiseView.tsx', content, 'utf8');
console.log('Done');
