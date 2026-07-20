import { describe, it, expect, beforeEach } from 'vitest';
import { reduceInventoryEvent } from '../inventoryReducer';
import { processInventoryEvent, saveStateFromAutosave } from '../syncRepository';
import { AppState, SyncableInventoryItem, InventoryEvent } from '../../types';
import { openDB } from 'idb';

const DB_NAME = 'Guard4CampersDB_V1';

describe('Inventory Reducer', () => {
  it('creates an item with version 1', () => {
    const event: InventoryEvent = {
      type: 'item_created',
      eventId: '1', itemId: 'item1', vehicleId: 'v1', actorId: 'a1', deviceId: 'd1', clientCreatedAt: new Date().toISOString(), schemaVersion: 1,
      payload: { name: 'Test', quantity: 1, unit: 'Stk' } as any
    };
    const result = reduceInventoryEvent(undefined, event);
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.item.version).toBe(1);
    }
  });

  it('quantity_delta updates quantity without checking base version', () => {
    const current: SyncableInventoryItem = { id: 'item1', version: 5, quantity: 10, name: 'Test' } as any;
    const event: InventoryEvent = {
      type: 'quantity_delta',
      eventId: '2', itemId: 'item1', vehicleId: 'v1', actorId: 'a1', deviceId: 'd1', clientCreatedAt: new Date().toISOString(), schemaVersion: 1, baseItemVersion: 1,
      payload: { delta: -2 }
    };
    const result = reduceInventoryEvent(current, event);
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.item.quantity).toBe(8);
      expect(result.item.version).toBe(6);
    }
  });

  it('item_updated checks base version and conflicts on mismatch', () => {
    const current: SyncableInventoryItem = { id: 'item1', version: 5, quantity: 10, name: 'Test' } as any;
    const event: InventoryEvent = {
      type: 'item_updated',
      eventId: '3', itemId: 'item1', vehicleId: 'v1', actorId: 'a1', deviceId: 'd1', clientCreatedAt: new Date().toISOString(), schemaVersion: 1, baseItemVersion: 4,
      payload: { name: 'Test 2' }
    };
    const result = reduceInventoryEvent(current, event);
    expect(result.status).toBe('conflict');
  });

  it('item_removed creates tombstone', () => {
    const current: SyncableInventoryItem = { id: 'item1', version: 5, quantity: 10, name: 'Test' } as any;
    const event: InventoryEvent = {
      type: 'item_removed',
      eventId: '4', itemId: 'item1', vehicleId: 'v1', actorId: 'a1', deviceId: 'd1', clientCreatedAt: new Date().toISOString(), schemaVersion: 1, baseItemVersion: 5
    };
    const result = reduceInventoryEvent(current, event);
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.item.deletedAt).toBeDefined();
    }
  });
  
  it('unknown item defers except on create', () => {
    const event: InventoryEvent = {
      type: 'quantity_delta',
      eventId: '5', itemId: 'unknown', vehicleId: 'v1', actorId: 'a1', deviceId: 'd1', clientCreatedAt: new Date().toISOString(), schemaVersion: 1, baseItemVersion: 1,
      payload: { delta: 1 }
    };
    const result = reduceInventoryEvent(undefined, event);
    expect(result.status).toBe('deferred');
  });
});
