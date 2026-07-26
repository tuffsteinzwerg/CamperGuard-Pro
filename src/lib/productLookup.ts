import { SYNC_BASE_URL } from './cloudflareProvider';

export interface ProductInfo {
  ean: string;
  name?: string;
  netWeight?: number;
  netUnit?: string;
  grossWeight?: number;
  grossUnit?: string;
  source: 'own' | 'openfoodfacts' | 'none';
}

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product/';

export async function lookupProduct(ean: string): Promise<ProductInfo> {
  const clean = String(ean).trim();
  try {
    const res = await fetch(SYNC_BASE_URL + '/product?ean=' + encodeURIComponent(clean));
    if (res.ok) {
      const data = await res.json();
      if (data && data.found && data.product) {
        const p = data.product;
        return {
          ean: clean,
          name: p.name || undefined,
          netWeight: p.net_weight != null ? Number(p.net_weight) : undefined,
          netUnit: p.net_unit || undefined,
          grossWeight: p.gross_weight != null ? Number(p.gross_weight) : undefined,
          grossUnit: p.gross_unit || undefined,
          source: 'own'
        };
      }
    }
  } catch { /* weiter zu OFF */ }

  try {
    const res = await fetch(OFF_BASE + encodeURIComponent(clean) + '.json?fields=product_name,brands,product_quantity,product_quantity_unit');
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 1 && data.product) {
        const p = data.product;
        const name = (p.product_name && String(p.product_name).trim())
          ? String(p.product_name).trim()
          : (p.brands ? String(p.brands).split(',')[0].trim() : undefined);
        const nwRaw = p.product_quantity;
        const nw = (nwRaw != null && nwRaw !== '') ? Number(nwRaw) : undefined;
        return {
          ean: clean,
          name,
          netWeight: (nw != null && !isNaN(nw)) ? nw : undefined,
          netUnit: p.product_quantity_unit || 'g',
          source: 'openfoodfacts'
        };
      }
    }
  } catch { /* nicht gefunden */ }

  return { ean: clean, source: 'none' };
}

export async function saveProduct(input: {
  ean: string; name?: string; netWeight?: number; netUnit?: string; grossWeight?: number; grossUnit?: string;
}): Promise<void> {
  try {
    await fetch(SYNC_BASE_URL + '/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
  } catch { /* offline egal */ }
}
