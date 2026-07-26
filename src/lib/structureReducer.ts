export type StructureApplyResult =
  | { status: 'applied'; subcategories: Record<string, string[]> }
  | { status: 'rejected'; reason: string };

const STRUCTURE_TYPES = [
  'subcategory_added',
  'subcategory_renamed',
  'subcategory_removed',
  'subcategory_reordered',
  'category_added',
  'category_removed'
];

export function isStructureEvent(event: any): boolean {
  return !!event && STRUCTURE_TYPES.indexOf(event.type) !== -1;
}

export function reduceStructureEvent(
  current: Record<string, string[]> | undefined,
  event: any
): StructureApplyResult {
  const subs: Record<string, string[]> = {};
  const src = (current && typeof current === 'object') ? current : {};
  for (const key of Object.keys(src)) {
    subs[key] = Array.isArray(src[key]) ? src[key].slice() : [];
  }

  const p = (event && event.payload) ? event.payload : {};
  const category = p.category;

  switch (event.type) {
    case 'category_added': {
      if (!category) return { status: 'rejected', reason: 'category fehlt' };
      if (!subs[category]) subs[category] = [];
      return { status: 'applied', subcategories: subs };
    }
    case 'category_removed': {
      if (!category) return { status: 'rejected', reason: 'category fehlt' };
      delete subs[category];
      return { status: 'applied', subcategories: subs };
    }
    case 'subcategory_added': {
      if (!category || !p.name) return { status: 'rejected', reason: 'Angaben fehlen' };
      if (!subs[category]) subs[category] = [];
      if (subs[category].indexOf(p.name) === -1) subs[category].push(p.name);
      return { status: 'applied', subcategories: subs };
    }
    case 'subcategory_removed': {
      if (!category || !p.name) return { status: 'rejected', reason: 'Angaben fehlen' };
      if (subs[category]) {
        subs[category] = subs[category].filter(function (n) { return n !== p.name; });
      }
      return { status: 'applied', subcategories: subs };
    }
    case 'subcategory_renamed': {
      if (!category || !p.from || !p.to) return { status: 'rejected', reason: 'Angaben fehlen' };
      const list = subs[category] || [];
      const idx = list.indexOf(p.from);
      if (idx === -1) {
        subs[category] = list;
        return { status: 'applied', subcategories: subs };
      }
      if (list.indexOf(p.to) !== -1) {
        subs[category] = list.filter(function (n) { return n !== p.from; });
        return { status: 'applied', subcategories: subs };
      }
      list[idx] = p.to;
      subs[category] = list;
      return { status: 'applied', subcategories: subs };
    }
    case 'subcategory_reordered': {
      if (!category || !Array.isArray(p.order)) return { status: 'rejected', reason: 'order fehlt' };
      const list = subs[category] || [];
      const ordered = p.order.filter(function (n: string) { return list.indexOf(n) !== -1; });
      const rest = list.filter(function (n) { return ordered.indexOf(n) === -1; });
      subs[category] = ordered.concat(rest);
      return { status: 'applied', subcategories: subs };
    }
    default:
      return { status: 'rejected', reason: 'Kein Struktur-Ereignis' };
  }
}
