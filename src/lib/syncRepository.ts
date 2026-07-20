import { openDB } from 'idb';
import { openAppDatabase } from './appDatabase';
import { AppState, InventoryEvent, SyncableInventoryItem } from '../types';
import { reduceInventoryEvent } from './inventoryReducer';

const DB_NAME = 'Guard4CampersDB_V1';

let writeQueue = Promise.resolve();

export async function processInventoryEvent(event: InventoryEvent): Promise<AppState> {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const db = await openAppDatabase();
        const tx = db.transaction(['store', 'eventLog', 'outbox', 'appliedEvents'], 'readwrite');
        const storeTx = tx.objectStore('store');
        const eventLogTx = tx.objectStore('eventLog');
        const outboxTx = tx.objectStore('outbox');
        const appliedEventsTx = tx.objectStore('appliedEvents');

        const alreadyApplied = await appliedEventsTx.get(event.eventId);
        if (alreadyApplied) {
           const state = await storeTx.get('state');
           db.close();
          resolve(state);
           return;
        }

        const state: AppState = await storeTx.get('state');
        if (!state) {
          throw new Error("No state found in DB");
        }

        const inventory = state.inventory || [];
        const itemIndex = inventory.findIndex(i => i.id === event.itemId);
        const currentItem = itemIndex >= 0 ? inventory[itemIndex] as SyncableInventoryItem : undefined;

        const result = reduceInventoryEvent(currentItem, event);

        if (result.status === 'applied') {
          if (itemIndex >= 0) {
            inventory[itemIndex] = result.item;
          } else {
            inventory.push(result.item);
          }
          
          state.inventory = inventory;
          state.inventoryRevision = (state.inventoryRevision || 0) + 1;
          
          await storeTx.put(state, 'state');
          await eventLogTx.put({ event, source: 'local', recordedAt: new Date().toISOString() });
          await outboxTx.put({ event, status: 'pending', retryCount: 0 });
          await appliedEventsTx.put({ eventId: event.eventId, appliedAt: new Date().toISOString() });
          
          await tx.done;
          db.close();
          resolve(state);
        } else {
          // If deferred or conflict, we don't apply, but maybe we shouldn't throw if it's a remote event?
          // For now, prompt implies local action should fail or succeed atomically.
          reject(new Error(`Event application failed: ${result.status} - ${result.reason}`));
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function saveStateFromAutosave(newState: AppState): Promise<AppState> {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const db = await openAppDatabase();
        const tx = db.transaction('store', 'readwrite');
        const storeTx = tx.objectStore('store');
        
        const dbState: AppState = await storeTx.get('state');
        if (dbState && (dbState.inventoryRevision || 0) > (newState.inventoryRevision || 0)) {
          newState.inventory = dbState.inventory;
          newState.inventoryRevision = dbState.inventoryRevision;
        } else {
          // If autosave has same or newer revision (shouldn't be newer unless transaction just ran),
          // we just save it. Actually, we should also ensure we don't drop events.
        }
        
        await storeTx.put(newState, 'state');
        await tx.done;
        db.close();
        resolve(newState);
      } catch (err) {
        reject(err);
      }
    });
  });
}

import { createUuid } from './uuid';

export async function dispatchInventoryEvent(
  state: AppState,
  type: InventoryEvent['type'],
  itemId: string,
  payload?: any,
  baseItemVersion?: number
): Promise<AppState> {
  const db = await openAppDatabase();
  let deviceId = await db.get('appMeta', 'deviceId');
  let actorId = await db.get('appMeta', 'actorId');
  if (!deviceId) {
    deviceId = createUuid();
    await db.put('appMeta', deviceId, 'deviceId');
  }
  if (!actorId) {
    actorId = createUuid();
    await db.put('appMeta', actorId, 'actorId');
  }
  db.close();

  const vehicleId = state.vehicleId || createUuid();

  const event: any = {
    eventId: createUuid(),
    type,
    itemId,
    vehicleId,
    actorId,
    deviceId,
    clientCreatedAt: new Date().toISOString(),
    schemaVersion: 1,
    baseItemVersion,
    payload
  };

  return processInventoryEvent(event);
}

export async function importState(backupData: AppState): Promise<AppState> {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const db = await openAppDatabase();
        
        // Preserve deviceId and actorId
        let deviceId = await db.get('appMeta', 'deviceId');
        let actorId = await db.get('appMeta', 'actorId');
        if (!deviceId) {
          deviceId = createUuid();
          await db.put('appMeta', deviceId, 'deviceId');
        }
        if (!actorId) {
          actorId = createUuid();
          await db.put('appMeta', actorId, 'actorId');
        }

        // Validate and migrate vehicleId
        let vehicleId = backupData.vehicleId;
        if (!vehicleId || typeof vehicleId !== 'string' || vehicleId.length < 10) {
          vehicleId = createUuid();
        }
        backupData.vehicleId = vehicleId;

        // Migrations
        if ((backupData.idMigrationVersion || 0) < 2) {
            // Apply ID migration as done in App.tsx
            if (Array.isArray(backupData.inventory)) {
               const seenIds = new Set();
               backupData.inventory = backupData.inventory.map(item => {
                 let id = item.id;
                 if (!id || seenIds.has(id)) {
                   do {
                     id = createUuid();
                   } while (seenIds.has(id));
                 }
                 seenIds.add(id);
                 return { ...item, id };
               });
             }
             backupData.idMigrationVersion = 2;
        }

        if ((backupData.syncModelVersion || 0) < 1) {
             if (Array.isArray(backupData.inventory)) {
               backupData.inventory = backupData.inventory.map(item => {
                 return { ...item, version: item.version || 1 };
               });
             }
             backupData.syncModelVersion = 1;
        }

        // Reset sync state
        await db.put('appMeta', {
           providerId: 'google_drive',
           initializationState: 'requires_initialization'
        }, 'syncState');

        // Clear event queues
        const tx = db.transaction(['store', 'eventLog', 'outbox', 'appliedEvents'], 'readwrite');
        await tx.objectStore('eventLog').clear();
        await tx.objectStore('outbox').clear();
        await tx.objectStore('appliedEvents').clear();
        
        backupData.inventoryRevision = (backupData.inventoryRevision || 0) + 1;
        await tx.objectStore('store').put(backupData, 'state');
        await tx.done;

        db.close();
        resolve(backupData);
      } catch (err) {
        reject(err);
      }
    });
  });
}
export function runSerializedAppWrite<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}
