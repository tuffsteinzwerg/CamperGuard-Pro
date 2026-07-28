import type { AppState, InventoryItem } from '../types';

export function printVorraetePaged(state: AppState) {
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fixedCategories = ["Küche", "Wohnen", "Bad", "Garage", "Technik"];
  const otherCategories = Object.keys(state.subcategories || {}).filter(c => !fixedCategories.includes(c));
  const allCategories = [...fixedCategories, ...otherCategories];
  const consumables = (state.inventory || []).filter((i: InventoryItem) => i.consumable === true && !i.deletedAt);

  const fmtUnit = (u?: string) => { const s = (u || '').trim().toLowerCase(); return (s === 'g' || s === 'gr' || s === 'gramm' || s === 'grams') ? 'g' : (s || 'stk'); };
  const esc = (v: any) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

  let rows = '';
  allCategories.forEach((cat) => {
    const items = consumables.filter((i: InventoryItem) => i.category === cat);
    if (!items.length) return;
    rows += '<div class="sec">🛒 ' + esc(cat.toUpperCase()) + '</div>';
    rows += '<div class="colh"><span class="chk">✓</span><span class="l">Artikel</span><span class="r">Menge</span></div>';
    items.forEach((it: InventoryItem) => {
      rows += '<div class="row"><span class="chk">☐</span><span class="l">' + esc(it.name) + '</span><span class="r">' + esc(it.quantity) + ' ' + esc(fmtUnit(it.unit)) + '</span></div>';
    });
  });
  if (!rows) rows = '<div class="empty">Keine Verbrauchsmaterialien markiert.</div>';

  const logoUrl = window.location.origin + '/g4c-druck-bunt-tp.png';

  const doc =
    '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Vorräte</title><style>' +
    '@page { size: A4; margin: 14mm 15mm 16mm 15mm;' +
    ' @bottom-left { content: "Guard4Campers – Smart, sicher, unterwegs."; font: 9pt Arial, sans-serif; color: #999; }' +
    ' @bottom-right { content: "Seite " counter(page) " von " counter(pages); font: 9pt Arial, sans-serif; color: #999; } }' +
    '* { box-sizing: border-box; } body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #222; }' +
    '.hd { position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 18mm; padding-bottom: 4px; margin-bottom: 4px; }' +
    '.hd img { height: 16mm; width: auto; }' +
    '.hd .t { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 16pt; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2px; line-height: 1.2; }' +
    '.hd .d { text-align: right; } .hd .d .val { font-size: 10pt; font-weight: 700; color: #111; } .hd .d .lbl { font-size: 9pt; color: #999; }' +
    '.sec { font-size: 10pt; font-weight: 700; color: #FF6600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4mm; margin-bottom: 1.5mm; padding-bottom: 1mm; border-bottom: 0.5pt solid #FF6600; }' +
    '.colh { display: grid; grid-template-columns: 5% 75% 20%; align-items: center; min-height: 7mm; padding: 0 0 1.5mm 0; border-bottom: 0.6pt solid #777; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.04em; color: #555; font-weight: 700; margin-top: 3mm; }' +
    '.row { display: grid; grid-template-columns: 5% 75% 20%; align-items: center; min-height: 6mm; padding: 1mm 0; border-bottom: 0.25pt solid #ddd; font-size: 11pt; page-break-inside: avoid; }' +
    '.chk { text-align: center; } .l { text-align: left; padding-left: 2mm; } .r { text-align: right; font-variant-numeric: tabular-nums; }' +
    '.row .chk { font-size: 11pt; color: #ccc; } .row .l { font-weight: 600; color: #111; } .row .r { color: #444; }' +
    '.empty { color: #666; font-size: 11pt; padding: 6mm 0; }' +
    '</style></head><body>' +
    '<div class="hd"><img src="' + logoUrl + '" alt="Guard4Campers"><div class="t">Vorräte</div>' +
    '<div class="d"><div class="val">' + esc(today) + '</div><div class="lbl">Ausdruck / Datum</div></div></div>' +
    rows +
    '<script>window.PagedConfig={auto:true,after:function(){try{window.focus();}catch(e){}setTimeout(function(){window.print();},400);}};</' + 'script>' +
    '<script src="' + window.location.origin + '/paged.polyfill.min.js"></' + 'script>' +
    '</body></html>';

  const win = window.open('', '_blank');
  if (!win) { alert('Zum Drucken bitte Pop-ups für Guard4Campers erlauben.'); return; }
  win.document.open();
  win.document.write(doc);
  win.document.close();
}
