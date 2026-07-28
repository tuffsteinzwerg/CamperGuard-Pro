// @ts-ignore - Vite raw-Import: print-styles.css als Text (einzige CSS-Quelle)
import printCssRaw from './print-styles.css?raw';

export function printBySelector(selector: string, title: string) {
  const el = document.querySelector(selector);
  if (el) printElementViaPaged(el.outerHTML, title);
}

export function printElementViaPaged(innerHtml: string, title: string) {
  const pageCss =
    'body{padding-bottom:0 !important;} .cg-print-footer{display:none !important;}' +
    '@page{size:A4;margin:14mm 15mm 16mm 15mm;' +
    '@bottom-left{content:"Guard4Campers – Smart, sicher, unterwegs.";font:9pt Arial,sans-serif;color:#999;}' +
    '@bottom-right{content:"Seite " counter(page) " von " counter(pages);font:9pt Arial,sans-serif;color:#999;}}';
  const doc =
    '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>' + title + '</title>' +
    '<style>' + printCssRaw + '</style>' +
    '<style>' + pageCss + '</style>' +
    '</head><body>' + innerHtml +
    '<script>window.PagedConfig={auto:true,after:function(){try{window.focus();}catch(e){}setTimeout(function(){window.print();},400);}};</' + 'script>' +
    '<script src="' + window.location.origin + '/paged.polyfill.min.js"></' + 'script>' +
    '</body></html>';
  const win = window.open('', '_blank');
  if (!win) { alert('Zum Drucken bitte Pop-ups für Guard4Campers erlauben.'); return; }
  win.document.open();
  win.document.write(doc);
  win.document.close();
}
