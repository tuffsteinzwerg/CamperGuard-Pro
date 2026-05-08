export const formatNumber = (num: number, decimals: number = 2) => num.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const formatWeight = (kg: number): string => {
  if (kg <= 0) return '';
  if (kg < 1) {
    const grams = Math.round(kg * 1000);
    return `${grams} g`;
  }
  return `${kg.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
};

export const normalizeGearName = (name: string) => {
  if (!name) return '';
  const n = name.trim().toLowerCase();
  const cleaned = n.replace(/[^a-z0-9]/g, '');
  if (cleaned.includes('warnweste') || cleaned.includes('warnwesten')) return 'Warnweste';
  if (n === 'erste-hilfe-kasten' || n === 'erste hilfe kasten' || n === 'erste hilfe-kasten' || n === 'verbandkasten' || n === 'verbandskasten') return 'Erste-Hilfe-Kasten';
  if (n === 'feuerlöschdecke' || n === 'feuerlöschdecken') return 'Feuerlöschdecke';
  if (n === 'warndreieck' || n === 'warndreiecke') return 'Warndreieck';
  if (n === 'feuerlöscher') return 'Feuerlöscher';
  return name.trim();
};
