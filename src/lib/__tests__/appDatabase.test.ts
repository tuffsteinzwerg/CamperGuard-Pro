import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { APP_DB_NAME, APP_DB_VERSION, openAppDatabaseByName, openAppDatabase } from '../appDatabase';
import { IDBDeferredEventRepository, IDBSyncStateRepository } from '../syncRepositories';

const TEST_DB_NAME = 'guard4campers-db-test';

describe('App Database Initialization', () => {
  beforeEach(async () => {
    await deleteDB(TEST_DB_NAME);
  });

  it('creates a full database directly on a new installation', async () => {
    // 1. Delete test db (done in beforeEach)
    // 2. Open DB via central function (simulating app start on fresh install)
    const db = await openAppDatabaseByName(TEST_DB_NAME);

    // 4. Verify all stores exist
    const expectedStores = [
      'store', 'appMeta', 'eventLog', 'outbox', 'appliedEvents', 
      'syncState', 'deferredEvents', 'syncConflicts'
    ];
    for (const store of expectedStores) {
      expect(db.objectStoreNames.contains(store)).toBe(true);
    }

    // Verify indexes
    const tx = db.transaction(['deferredEvents', 'syncConflicts'], 'readonly');
    expect(tx.objectStore('deferredEvents').indexNames.contains('itemId')).toBe(true);
    expect(tx.objectStore('syncConflicts').indexNames.contains('status')).toBe(true);
    
    db.close();
  });

  it('correctly upgrades from v3 to v4', async () => {
    // 8. Create a v3 database
    const db3 = await openDB(TEST_DB_NAME, 3, {
      upgrade(db, oldVersion) {
        db.createObjectStore('store');
        db.createObjectStore('appMeta');
        db.createObjectStore('eventLog', { keyPath: 'event.eventId' });
        db.createObjectStore('outbox', { keyPath: 'event.eventId' });
        db.createObjectStore('appliedEvents', { keyPath: 'eventId' });
        db.createObjectStore('syncState', { keyPath: 'providerId' });
      }
    });

    // Write some test data to ensure it's preserved
    const tx3 = db3.transaction('appMeta', 'readwrite');
    await tx3.store.put({ idMigrationVersion: 2 }, 'appState');
    await tx3.done;
    
    // 9. Close it
    db3.close();

    // 10. Open via central v4 function
    const db4 = await openAppDatabaseByName(TEST_DB_NAME);
    
    // 11. Check that old data is preserved
    const state = await db4.get('appMeta', 'appState');
    expect(state).toEqual({ idMigrationVersion: 2 });

    // Check that new stores and indexes exist
    expect(db4.objectStoreNames.contains('deferredEvents')).toBe(true);
    expect(db4.objectStoreNames.contains('syncConflicts')).toBe(true);

    const tx4 = db4.transaction(['deferredEvents', 'syncConflicts'], 'readonly');
    expect(tx4.objectStore('deferredEvents').indexNames.contains('itemId')).toBe(true);
    expect(tx4.objectStore('syncConflicts').indexNames.contains('status')).toBe(true);

    db4.close();
  });
  
  it('prevents incomplete DB creation if a repository accesses it first', async () => {
    // This reproduces the bug if the bug existed. Since we changed repositories to use openAppDatabaseByName,
    // they will trigger the full upgrade.
    // However, the test should use the real repository, which defaults to APP_DB_NAME.
    // Let's clear the real one just for this test
    await deleteDB(APP_DB_NAME);

    // 12. Open IDBSyncStateRepository first
    const syncStateRepo = new IDBSyncStateRepository();
    await syncStateRepo.save({ providerId: 'test', initializationState: 'ready' });

    // 13. Open IDBDeferredEventRepository next
    const deferredRepo = new IDBDeferredEventRepository();
    const count = await deferredRepo.count();
    expect(count).toBe(0);

    // 14. Open via central App DB init
    const db = await openAppDatabase();

    // 15. Verify all stores exist
    const expectedStores = [
      'store', 'appMeta', 'eventLog', 'outbox', 'appliedEvents', 
      'syncState', 'deferredEvents', 'syncConflicts'
    ];
    for (const store of expectedStores) {
      expect(db.objectStoreNames.contains(store)).toBe(true);
    }
    
    db.close();
  });
});
