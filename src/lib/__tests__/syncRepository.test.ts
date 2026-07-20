import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { processInventoryEvent, saveStateFromAutosave } from '../syncRepository';
import { AppState, InventoryEvent } from '../../types';
import { openDB, deleteDB } from 'idb';
import { openAppDatabaseByName } from '../appDatabase';

import { APP_DB_NAME } from '../appDatabase';
const DB_NAME = APP_DB_NAME;

async function initDB() {
  return openAppDatabaseByName(DB_NAME);
}

describe('Sync Repository', () => {
  beforeEach(async () => {
    await deleteDB(DB_NAME);
    const db = await initDB();
    await db.put('store', { inventory: [], inventoryRevision: 1 } as AppState, 'state');
    db.close();
  });

  it('atomic save of all four records', async () => {
    const event: InventoryEvent = {
      type: 'item_created',
      eventId: 'evt1', itemId: 'item1', vehicleId: 'v1', actorId: 'a1', deviceId: 'd1', clientCreatedAt: new Date().toISOString(), schemaVersion: 1,
      payload: { name: 'Atomic Test', quantity: 1, unit: 'Stk' } as any
    };

    const newState = await processInventoryEvent(event);
    expect(newState.inventory.length).toBe(1);
    expect(newState.inventoryRevision).toBe(2);

    const db = await openAppDatabaseByName(DB_NAME);
    const storedState = await db.get('store', 'state');
    expect(storedState.inventory.length).toBe(1);

    const log = await db.get('eventLog', 'evt1');
    expect(log).toBeDefined();

    const outbox = await db.get('outbox', 'evt1');
    expect(outbox).toBeDefined();

    const applied = await db.get('appliedEvents', 'evt1');
    expect(applied).toBeDefined();
    db.close();
  });

  it('duplicate event id is not applied twice', async () => {
    const event: InventoryEvent = {
      type: 'item_created',
      eventId: 'evt2', itemId: 'item2', vehicleId: 'v1', actorId: 'a1', deviceId: 'd1', clientCreatedAt: new Date().toISOString(), schemaVersion: 1,
      payload: { name: 'Dup Test', quantity: 1, unit: 'Stk' } as any
    };

    await processInventoryEvent(event);
    const db1 = await openAppDatabaseByName(DB_NAME);
    let state = await db1.get('store', 'state');
    expect(state.inventory.length).toBe(1);
    db1.close();

    // Re-apply same event
    const newState = await processInventoryEvent(event);
    
    const db2 = await openAppDatabaseByName(DB_NAME);
    state = await db2.get('store', 'state');
    expect(state.inventory.length).toBe(1); // Still 1
    db2.close();
  });

  it('autosave does not overwrite newer transactional state', async () => {
    const event: InventoryEvent = {
      type: 'item_created',
      eventId: 'evt3', itemId: 'item3', vehicleId: 'v1', actorId: 'a1', deviceId: 'd1', clientCreatedAt: new Date().toISOString(), schemaVersion: 1,
      payload: { name: 'Autosave Test', quantity: 1, unit: 'Stk' } as any
    };

    await processInventoryEvent(event);
    
    // Simulate autosave from older React state
    const olderState: AppState = { inventory: [], inventoryRevision: 1 } as AppState;
    const resolvedState = await saveStateFromAutosave(olderState);
    
    const db = await openAppDatabaseByName(DB_NAME);
    const state = await db.get('store', 'state');
    expect(state.inventory.length).toBe(1);
    expect(state.inventory[0].id).toBe('item3');
    
    // The resolved state should have the merged inventory
    expect(resolvedState.inventory.length).toBe(1);
    db.close();
  });
});
