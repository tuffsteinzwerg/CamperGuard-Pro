import { openDB } from 'idb';
import { openAppDatabase, openAppDatabaseByName } from './appDatabase';
import { 
  DeferredEventRecord, 
  DeferredEventRepository,
  SyncConflictRecord,
  SyncConflictRepository,
  SyncStateRepository
} from './syncTypes';
import { LocalSyncState } from '../types';


export class IDBDeferredEventRepository implements DeferredEventRepository {
  constructor(private dbName: string = 'Guard4CampersDB_V1') {}
  async get(eventId: string): Promise<DeferredEventRecord | undefined> {
    const db = await openAppDatabaseByName(this.dbName);
    const result = await db.get('deferredEvents', eventId);
    db.close();
    return result;
  }

  async put(record: DeferredEventRecord): Promise<void> {
    const db = await openAppDatabaseByName(this.dbName);
    await db.put('deferredEvents', record);
    db.close();
  }

  async delete(eventId: string): Promise<void> {
    const db = await openAppDatabaseByName(this.dbName);
    await db.delete('deferredEvents', eventId);
    db.close();
  }

  async listByItemId(itemId: string): Promise<DeferredEventRecord[]> {
    const db = await openAppDatabaseByName(this.dbName);
    const result = await db.getAllFromIndex('deferredEvents', 'itemId', itemId);
    db.close();
    return result;
  }

  async listAll(): Promise<DeferredEventRecord[]> {
    const db = await openAppDatabaseByName(this.dbName);
    const result = await db.getAll('deferredEvents');
    db.close();
    return result;
  }

  async count(): Promise<number> {
    const db = await openAppDatabaseByName(this.dbName);
    const result = await db.count('deferredEvents');
    db.close();
    return result;
  }
}

export class IDBSyncConflictRepository implements SyncConflictRepository {
  constructor(private dbName: string = 'Guard4CampersDB_V1') {}
  async get(conflictId: string): Promise<SyncConflictRecord | undefined> {
    const db = await openAppDatabaseByName(this.dbName);
    const result = await db.get('syncConflicts', conflictId);
    db.close();
    return result;
  }

  async put(record: SyncConflictRecord): Promise<void> {
    const db = await openAppDatabaseByName(this.dbName);
    await db.put('syncConflicts', record);
    db.close();
  }

  async updateStatus(
    conflictId: string,
    status: SyncConflictRecord["status"],
    resolvedAt?: string
  ): Promise<void> {
    const db = await openAppDatabaseByName(this.dbName);
    const record = await db.get('syncConflicts', conflictId);
    if (record) {
      record.status = status;
      if (resolvedAt) {
        record.resolvedAt = resolvedAt;
      }
      await db.put('syncConflicts', record);
    }
    db.close();
  }

  async listOpen(): Promise<SyncConflictRecord[]> {
    const db = await openAppDatabaseByName(this.dbName);
    const result = await db.getAllFromIndex('syncConflicts', 'status', 'open');
    db.close();
    return result;
  }

  async listAll(): Promise<SyncConflictRecord[]> {
    const db = await openAppDatabaseByName(this.dbName);
    const result = await db.getAll('syncConflicts');
    db.close();
    return result;
  }

  async countOpen(): Promise<number> {
    const db = await openAppDatabaseByName(this.dbName);
    const result = await db.countFromIndex('syncConflicts', 'status', 'open');
    db.close();
    return result;
  }
}

export class IDBSyncStateRepository implements SyncStateRepository {
  constructor(private dbName: string = 'Guard4CampersDB_V1') {}
  async get(providerId: string): Promise<LocalSyncState | undefined> {
    const db = await openAppDatabaseByName(this.dbName);
    const result = await db.get('syncState', providerId);
    db.close();
    return result;
  }

  async save(state: LocalSyncState): Promise<void> {
    const db = await openAppDatabaseByName(this.dbName);
    await db.put('syncState', state);
    db.close();
  }

  async update(
    providerId: string,
    updater: (current: LocalSyncState | undefined) => LocalSyncState
  ): Promise<LocalSyncState> {
    const db = await openAppDatabaseByName(this.dbName);
    const tx = db.transaction('syncState', 'readwrite');
    const current = await tx.store.get(providerId);
    const next = updater(current);
    await tx.store.put(next);
    await tx.done;
    db.close();
    return next;
  }

  async delete(providerId: string): Promise<void> {
    const db = await openAppDatabaseByName(this.dbName);
    await db.delete('syncState', providerId);
    db.close();
  }
}
