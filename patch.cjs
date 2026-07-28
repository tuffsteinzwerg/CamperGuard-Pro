const fs = require('fs');
let content = fs.readFileSync('/app/applet/src/views/InhaltView.tsx', 'utf8');

const target1 = `  const [printMode, setPrintMode] = useState<'all' | 'consumables'>('all');
  const [pendingPrint, setPendingPrint] = useState(false);
  useEffect(() => {
    if (!pendingPrint) return;
    window.print();
    setPendingPrint(false);
  }, [pendingPrint]);
  const runPrint = (mode: 'all' | 'consumables') => {
    setPrintMenuOpen(false);
    if (mode === 'consumables') {
      const html = renderToStaticMarkup(<InhaltPrintView state={state} printMode="consumables" />);
      printElementViaPaged(html, 'Vorräte');
      return;
    }
    setPrintMode(mode);
    setPendingPrint(true);
  };`;

const repl1 = `  const runPrint = (mode: 'all' | 'consumables') => {
    setPrintMenuOpen(false);
    const html = renderToStaticMarkup(<InhaltPrintView state={state} printMode={mode} />);
    printElementViaPaged(html, mode === 'consumables' ? 'Vorräte' : 'Inventarliste');
  };`;

const target2 = `      <InhaltPrintView state={state} printMode={printMode} />\n`;
const repl2 = ``;

if(content.includes(target1) && content.includes(target2)) {
    content = content.replace(target1, repl1).replace(target2, repl2);
    fs.writeFileSync('/app/applet/src/views/InhaltView.tsx', content, 'utf8');
    console.log("Success");
} else {
    console.log("Failed to match");
    console.log("T1", content.includes(target1));
    console.log("T2", content.includes(target2));
}
