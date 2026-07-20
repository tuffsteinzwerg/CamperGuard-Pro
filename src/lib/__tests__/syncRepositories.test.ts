import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB, deleteDB } from 'idb';
import { openAppDatabaseByName } from '../appDatabase';
import { 
  IDBDeferredEventRepository, 
  IDBSyncConflictRepository, 
  IDBSyncStateRepository 
} from '../syncRepositories';
import { DeferredEventRecord, SyncConflictRecord } from '../syncTypes';

const DB_NAME = 'guard4campers-db';

async function initTestDB() {
  await deleteDB(DB_NAME);
  return openAppDatabaseByName(DB_NAME);
}

describe('Sync Repositories', () => {
  beforeEach(async () => {
    const db = await initTestDB();
    db.close();
  });

  it('DB upgrade created deferredEvents and syncConflicts', async () => {
    const db = await openAppDatabaseByName(DB_NAME);
    expect(db.objectStoreNames.contains('deferredEvents')).toBe(true);
    expect(db.objectStoreNames.contains('syncConflicts')).toBe(true);
    db.close();
  });

  describe('DeferredEventRepository', () => {
    it('can save and load a deferred event', async () => {
      const repo = new IDBDeferredEventRepository();
      const record: DeferredEventRecord = {
        event: {
          type: 'item_removed',
          eventId: 'evt-1',
          itemId: 'item-1',
          vehicleId: 'v-1',
          actorId: 'a-1',
          deviceId: 'd-1',
          clientCreatedAt: '2023-01-01T00:00:00Z',
          schemaVersion: 1
        },
        reason: 'Missing dependencies',
        retryCount: 0,
        firstDeferredAt: '2023-01-01T00:00:00Z',
        lastAttemptAt: '2023-01-01T00:00:00Z'
      };

      await repo.put(record);
      const loaded = await repo.get('evt-1');
      expect(loaded).toEqual(record);

      const count = await repo.count();
      expect(count).toBe(1);

      const all = await repo.listAll();
      expect(all.length).toBe(1);
      
      const byItem = await repo.listByItemId('item-1');
      expect(byItem.length).toBe(1);

      await repo.delete('evt-1');
      expect(await repo.get('evt-1')).toBeUndefined();
    });
  });

  describe('SyncConflictRepository', () => {
    it('can save, load, and resolve a conflict', async () => {
      const repo = new IDBSyncConflictRepository();
      const conflict: SyncConflictRecord = {
        conflictId: 'conf-1',
        event: {
          type: 'item_removed',
          eventId: 'evt-2',
          itemId: 'item-2',
          vehicleId: 'v-1',
          actorId: 'a-1',
          deviceId: 'd-1',
          clientCreatedAt: '2023-01-01T00:00:00Z',
          schemaVersion: 1
        },
        reason: 'Concurrent modification',
        status: 'open',
        createdAt: '2023-01-01T00:00:00Z'
      };

      await repo.put(conflict);
      
      const loaded = await repo.get('conf-1');
      expect(loaded).toEqual(conflict);

      const openCount = await repo.countOpen();
      expect(openCount).toBe(1);

      const openConflicts = await repo.listOpen();
      expect(openConflicts.length).toBe(1);

      await repo.updateStatus('conf-1', 'resolved', '2023-01-02T00:00:00Z');
      
      const updated = await repo.get('conf-1');
      expect(updated?.status).toBe('resolved');
      expect(updated?.resolvedAt).toBe('2023-01-02T00:00:00Z');

      expect(await repo.countOpen()).toBe(0);
    });
  });

  describe('SyncStateRepository', () => {
    it('can save and update the cursor', async () => {
      const repo = new IDBSyncStateRepository();
      await repo.save({
        providerId: 'google_drive',
        initializationState: 'ready',
        remoteCursor: 'cursor-1'
      });

      const loaded = await repo.get('google_drive');
      expect(loaded?.remoteCursor).toBe('cursor-1');

      await repo.update('google_drive', (current) => {
        if (!current) throw new Error('not found');
        return { ...current, remoteCursor: 'cursor-2' };
      });

      const updated = await repo.get('google_drive');
      expect(updated?.remoteCursor).toBe('cursor-2');

      await repo.delete('google_drive');
      expect(await repo.get('google_drive')).toBeUndefined();
    });
  });
});
