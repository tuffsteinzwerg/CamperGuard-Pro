import { openDB, IDBPDatabase } from 'idb';

export const APP_DB_NAME = 'Guard4CampersDB_V1';
export const APP_DB_VERSION = 4;

export function openAppDatabase(): Promise<IDBPDatabase> {
  return openAppDatabaseByName(APP_DB_NAME);
}

export function openAppDatabaseByName(databaseName: string): Promise<IDBPDatabase> {
  return openDB(databaseName, APP_DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1 || !db.objectStoreNames.contains('store')) {
        if (!db.objectStoreNames.contains('store')) db.createObjectStore('store');
      }
      if (oldVersion < 2 || !db.objectStoreNames.contains('appMeta')) {
        if (!db.objectStoreNames.contains('appMeta')) db.createObjectStore('appMeta');
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('eventLog')) {
          db.createObjectStore('eventLog', { keyPath: 'event.eventId' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'event.eventId' });
        }
        if (!db.objectStoreNames.contains('appliedEvents')) {
          db.createObjectStore('appliedEvents', { keyPath: 'eventId' });
        }
        if (!db.objectStoreNames.contains('syncState')) {
          db.createObjectStore('syncState', { keyPath: 'providerId' });
        }
      }
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('deferredEvents')) {
          const deferredEvents = db.createObjectStore('deferredEvents', { keyPath: 'event.eventId' });
          deferredEvents.createIndex('itemId', 'event.itemId');
        } else {
          const store = transaction.objectStore('deferredEvents');
          if (!store.indexNames.contains('itemId')) {
            store.createIndex('itemId', 'event.itemId');
          }
        }
        if (!db.objectStoreNames.contains('syncConflicts')) {
          const syncConflicts = db.createObjectStore('syncConflicts', { keyPath: 'conflictId' });
          syncConflicts.createIndex('status', 'status');
        } else {
          const store = transaction.objectStore('syncConflicts');
          if (!store.indexNames.contains('status')) {
            store.createIndex('status', 'status');
          }
        }
      }
    },
  });
}
