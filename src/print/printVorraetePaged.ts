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
    rows += '<div class="colh"><span>✓</span><span class="l">Artikel</span><span class="r">Menge</span></div>';
    items.forEach((it: InventoryItem) => {
      rows += '<div class="row"><span>☐</span><span class="l">' + esc(it.name) + '</span><span class="r">' + esc(it.quantity) + ' ' + esc(fmtUnit(it.unit)) + '</span></div>';
    });
  });
  if (!rows) rows = '<div class="empty">Keine Verbrauchsmaterialien markiert.</div>';

  const logoUrl = window.location.origin + '/g4c-druck-bunt-tp.png';

  const doc =
    '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Vorräte</title><style>' +
    '@page { size: A4; margin: 14mm 15mm 16mm 15mm;' +
    ' @bottom-left { content: "Guard4Campers – Smart, sicher, unterwegs."; font: 9pt Arial, sans-serif; color: #999; }' +
    ' @bottom-right { content: "Seite " counter(page) " von " counter(pages); font: 9pt Arial, sans-serif; color: #999; } }' +
    '* { box-sizing: border-box; } body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; }' +
    '.hd { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #FF6600; padding-bottom: 6px; margin-bottom: 8px; }' +
    '.hd img { height: 16mm; width: auto; } .hd .t { font-size: 16pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }' +
    '.hd .d { text-align: right; font-size: 10pt; font-weight: 700; } .hd .d .lbl { font-size: 9pt; color: #999; font-weight: 400; }' +
    '.sec { color: #FF6600; font-weight: 700; font-size: 10pt; text-transform: uppercase; margin: 6px 0 2px; }' +
    '.colh { display: grid; grid-template-columns: 8mm 1fr 30mm; font-size: 9pt; color: #555; font-weight: 700; text-transform: uppercase; border-bottom: 0.6pt solid #777; padding-bottom: 1mm; }' +
    '.row { display: grid; grid-template-columns: 8mm 1fr 30mm; font-size: 11pt; padding: 1mm 0; border-bottom: 0.4pt solid #ddd; }' +
    '.row .l, .colh .l { padding-left: 2mm; } .row .r, .colh .r { text-align: right; }' +
    '.empty { color: #666; font-size: 11pt; padding: 6mm 0; }' +
    '</style></head><body>' +
    '<div class="hd"><img src="' + logoUrl + '" alt="Guard4Campers"><div class="t">Vorräte</div>' +
    '<div class="d"><div>' + esc(today) + '</div><div class="lbl">Ausdruck / Datum</div></div></div>' +
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
