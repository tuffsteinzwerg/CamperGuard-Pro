import { describe, it, expect } from 'vitest';
import { isStructureEvent, reduceStructureEvent } from '../structureReducer';

const ev = (type: string, payload: any) => ({ type, payload } as any);

describe('structureReducer', () => {
  it('erkennt Struktur-Ereignisse und Artikel-Ereignisse auseinander', () => {
    expect(isStructureEvent(ev('subcategory_added', {}))).toBe(true);
    expect(isStructureEvent(ev('category_removed', {}))).toBe(true);
    expect(isStructureEvent(ev('item_created', {}))).toBe(false);
    expect(isStructureEvent(ev('quantity_delta', {}))).toBe(false);
    expect(isStructureEvent(null)).toBe(false);
  });

  it('legt einen Lagerort an und ist dabei wiederholbar (idempotent)', () => {
    const start = { 'Küche': [] as string[] };
    const r1 = reduceStructureEvent(start, ev('subcategory_added', { category: 'Küche', name: 'Schrank' }));
    expect(r1.status).toBe('applied');
    expect((r1 as any).subcategories['Küche']).toEqual(['Schrank']);

    const r2 = reduceStructureEvent((r1 as any).subcategories, ev('subcategory_added', { category: 'Küche', name: 'Schrank' }));
    expect((r2 as any).subcategories['Küche']).toEqual(['Schrank']);
  });

  it('veraendert die Eingabe NICHT (kein versehentliches Ueberschreiben)', () => {
    const start = { 'Küche': ['Schrank'] };
    reduceStructureEvent(start, ev('subcategory_added', { category: 'Küche', name: 'Fach' }));
    expect(start['Küche']).toEqual(['Schrank']);
  });

  it('benennt um und behaelt die Position', () => {
    const start = { 'Küche': ['A', 'B', 'C'] };
    const r = reduceStructureEvent(start, ev('subcategory_renamed', { category: 'Küche', from: 'B', to: 'Bravo' }));
    expect((r as any).subcategories['Küche']).toEqual(['A', 'Bravo', 'C']);
  });

  it('Umbenennen zweimal angewendet aendert nichts mehr', () => {
    const start = { 'Küche': ['A', 'Bravo'] };
    const r = reduceStructureEvent(start, ev('subcategory_renamed', { category: 'Küche', from: 'B', to: 'Bravo' }));
    expect(r.status).toBe('applied');
    expect((r as any).subcategories['Küche']).toEqual(['A', 'Bravo']);
  });

  it('Umbenennen auf einen schon vorhandenen Namen verschmilzt statt zu doppeln', () => {
    const start = { 'Küche': ['A', 'B'] };
    const r = reduceStructureEvent(start, ev('subcategory_renamed', { category: 'Küche', from: 'A', to: 'B' }));
    expect((r as any).subcategories['Küche']).toEqual(['B']);
  });

  it('loescht einen Lagerort, wiederholbar', () => {
    const start = { 'Küche': ['A', 'B'] };
    const r1 = reduceStructureEvent(start, ev('subcategory_removed', { category: 'Küche', name: 'A' }));
    expect((r1 as any).subcategories['Küche']).toEqual(['B']);
    const r2 = reduceStructureEvent((r1 as any).subcategories, ev('subcategory_removed', { category: 'Küche', name: 'A' }));
    expect((r2 as any).subcategories['Küche']).toEqual(['B']);
  });

  it('sortiert um und haengt unbekannte Namen hinten an', () => {
    const start = { 'Küche': ['A', 'B', 'C'] };
    const r = reduceStructureEvent(start, ev('subcategory_reordered', { category: 'Küche', order: ['C', 'A', 'WEG'] }));
    expect((r as any).subcategories['Küche']).toEqual(['C', 'A', 'B']);
  });

  it('legt Hauptbereich an und loescht ihn', () => {
    const r1 = reduceStructureEvent({}, ev('category_added', { category: 'Werkstatt' }));
    expect((r1 as any).subcategories['Werkstatt']).toEqual([]);
    const r2 = reduceStructureEvent((r1 as any).subcategories, ev('category_removed', { category: 'Werkstatt' }));
    expect((r2 as any).subcategories['Werkstatt']).toBeUndefined();
  });

  it('lehnt unvollstaendige Angaben ab', () => {
    expect(reduceStructureEvent({}, ev('subcategory_added', { category: 'Küche' })).status).toBe('rejected');
    expect(reduceStructureEvent({}, ev('subcategory_renamed', { category: 'Küche', from: 'A' })).status).toBe('rejected');
    expect(reduceStructureEvent({}, ev('subcategory_reordered', { category: 'Küche' })).status).toBe('rejected');
    expect(reduceStructureEvent({}, ev('item_created', {})).status).toBe('rejected');
  });

  it('kommt mit kaputten Ausgangsdaten klar', () => {
    const r = reduceStructureEvent({ 'Küche': 'kaputt' } as any, ev('subcategory_added', { category: 'Küche', name: 'A' }));
    expect((r as any).subcategories['Küche']).toEqual(['A']);
  });
});
