import { openAppDatabase } from './appDatabase';

export interface DatabaseProvider {
  openAppDatabase(): Promise<import('idb').IDBPDatabase>;
  runSerializedAppWrite<T>(task: () => Promise<T>): Promise<T>;
}

import { SyncProvider, SyncStateRepository } from './syncTypes';
import { OutboxEntry, LocalSyncState, AppState } from '../types';
import { reduceInventoryEvent } from './inventoryReducer';
import { runSerializedAppWrite } from './syncRepository';

export type SyncStatus = 
  | "idle"
  | "requires_initialization"
  | "disconnected"
  | "uploading"
  | "downloading"
  | "offline"
  | "access_revoked"
  | "error";

export interface UploadRunResult {
  selectedCount: number;
  acceptedCount: number;
  retryableFailureCount: number;
  permanentFailureCount: number;
  pendingCount: number;
  completedAt: string;
}


export interface DeferredRunResult {
  selectedCount: number;
  appliedCount: number;
  stillDeferredCount: number;
  conflictCount: number;
  permanentFailureCount: number;
  completedAt: string;
}

export interface SyncRunResult {
  upload?: UploadRunResult;
  download?: DownloadRunResult;
  deferred?: DeferredRunResult;
  completedAt: string;
}

export interface DownloadRunResult {
  downloadedCount: number;
  appliedCount: number;
  alreadyAppliedCount: number;
  deferredCount: number;
  conflictCount: number;
  pageCount: number;
  newCursor?: string;
  completedAt: string;
}

export interface SyncCoordinatorClock {
  nowIso(): string;
  nowMs(): number;
}

export class DefaultSyncCoordinatorClock implements SyncCoordinatorClock {
  nowIso(): string {
    return new Date().toISOString();
  }
  nowMs(): number {
    return Date.now();
  }
}

export const MAX_UPLOAD_BATCH_SIZE = 50;
export const DOWNLOAD_PAGE_SIZE = 100;
export const BASE_RETRY_DELAY_MS = 2000;
export const MAX_RETRY_DELAY_MS = 300000;
export const UPLOAD_LEASE_DURATION_MS = 30000; // 30 seconds

export class SyncCoordinator {

  private deferredInFlight: Promise<DeferredRunResult> | null = null;
  private syncInFlight: Promise<SyncRunResult> | null = null;

  async runSync(): Promise<SyncRunResult> {
    if (this.syncInFlight) return this.syncInFlight;
    this.syncInFlight = this._doSync().finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  private async _doSync(): Promise<SyncRunResult> {
    const upload = await this.runUpload();
    const download = await this.runDownload();
    const deferred = await this.runDeferredProcessing();
    
    return {
      upload,
      download,
      deferred,
      completedAt: this.clock.nowIso()
    };
  }

  async runDeferredProcessing(): Promise<DeferredRunResult> {
    if (this.deferredInFlight) return this.deferredInFlight;
    this.deferredInFlight = this._doDeferred().finally(() => {
      this.deferredInFlight = null;
    });
    return this.deferredInFlight;
  }

  private async _doDeferred(): Promise<DeferredRunResult> {
    const MAX_DEFERRED_RETRIES = 5;
    const result: DeferredRunResult = {
      selectedCount: 0,
      appliedCount: 0,
      stillDeferredCount: 0,
      conflictCount: 0,
      permanentFailureCount: 0,
      completedAt: this.clock.nowIso()
    };

    const connected = await this.provider.isConnected();
    if (!connected) {
      this.setStatus("disconnected");
      return result;
    }

    const state = await this.stateRepository.get(this.provider.providerId);
    if (state?.initializationState === "requires_initialization") {
      this.setStatus("requires_initialization");
      return result;
    }

    await this.runWrite(async () => {
      const db = await this.openDb();
      const tx = db.transaction(['store', 'eventLog', 'appliedEvents', 'deferredEvents', 'syncConflicts'], 'readwrite');
      tx.done.catch(() => {});
      try {
        const localState = await tx.objectStore('store').get('state');
        if (!localState || !localState.vehicleId) {
          throw new Error("Invalid local state during deferred processing");
        }

        const vehicleId = localState.vehicleId;
        const allDeferred = await tx.objectStore('deferredEvents').getAll();
        
        // Sort deterministically (e.g. by firstDeferredAt)
        allDeferred.sort((a, b) => a.firstDeferredAt.localeCompare(b.firstDeferredAt));

        let inventory = localState.inventory || [];
        let stateChanged = false;

        for (const entry of allDeferred) {
          if (entry.status === 'permanent_failure') continue;
          if (entry.event.vehicleId !== vehicleId) { entry.status = 'permanent_failure'; entry.reason = 'Vehicle mismatch'; await tx.objectStore('deferredEvents').put(entry); result.permanentFailureCount++; continue; }

          const alreadyApplied = await tx.objectStore('appliedEvents').get(entry.event.eventId);
          if (alreadyApplied) {
             await tx.objectStore('deferredEvents').delete(entry.event.eventId);
             continue;
          }

          if (entry.retryCount >= MAX_DEFERRED_RETRIES) {
             entry.status = 'permanent_failure';
             await tx.objectStore('deferredEvents').put(entry);
             result.permanentFailureCount++;
             continue;
          }

          result.selectedCount++;
          
          const itemIndex = inventory.findIndex((i) => i.id === entry.event.itemId);
          const currentItem = itemIndex >= 0 ? inventory[itemIndex] : undefined;
          
          const reduceResult = reduceInventoryEvent(currentItem, entry.event);

          if (reduceResult.status === 'applied') {
             if (itemIndex >= 0) {
               inventory[itemIndex] = reduceResult.item;
             } else {
               inventory.push(reduceResult.item);
             }
             stateChanged = true;
             
             await tx.objectStore('eventLog').put({ event: entry.event, source: 'remote', recordedAt: this.clock.nowIso() });
             await tx.objectStore('appliedEvents').put({ eventId: entry.event.eventId, appliedAt: this.clock.nowIso() });
             await tx.objectStore('deferredEvents').delete(entry.event.eventId);
             
             result.appliedCount++;
          } else if (reduceResult.status === 'deferred') {
             entry.retryCount++;
             entry.lastAttemptAt = this.clock.nowIso();
             entry.reason = reduceResult.reason;
             
             if (entry.retryCount >= MAX_DEFERRED_RETRIES) {
                 entry.status = 'permanent_failure';
                 await tx.objectStore('deferredEvents').put(entry);
                 result.permanentFailureCount++;
             } else {
                 await tx.objectStore('deferredEvents').put(entry);
                 result.stillDeferredCount++;
             }
          } else if (reduceResult.status === 'conflict') {
             await tx.objectStore('syncConflicts').put({
                conflictId: entry.event.eventId,
                event: entry.event,
                currentItem,
                reason: reduceResult.reason,
                status: 'open',
                createdAt: this.clock.nowIso()
             });
             await tx.objectStore('deferredEvents').delete(entry.event.eventId);
             result.conflictCount++;
          } else {
             entry.retryCount++;
             entry.status = 'permanent_failure';
             entry.reason = reduceResult.reason;
             await tx.objectStore('deferredEvents').put(entry);
             result.permanentFailureCount++;
          }
        }

        if (stateChanged) {
          localState.inventory = inventory;
          localState.inventoryRevision = (localState.inventoryRevision || 0) + 1;
          await tx.objectStore('store').put(localState, 'state');
        }

        await tx.done;
      } catch(err) {
        tx.abort();
        throw err;
      } finally {
        db.close();
      }
    });

    result.completedAt = this.clock.nowIso();
    return result;
  }

  private status: SyncStatus = "idle";
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private uploadInFlight: Promise<UploadRunResult> | null = null;
  private downloadInFlight: Promise<DownloadRunResult> | null = null;

  constructor(
    private provider: SyncProvider,
    private stateRepository: SyncStateRepository,
    private clock: SyncCoordinatorClock = new DefaultSyncCoordinatorClock(),
    private random: () => number = Math.random,
    private dbProvider?: DatabaseProvider
  ) {}

  private openDb() {
    return this.dbProvider ? this.dbProvider.openAppDatabase() : openAppDatabase();
  }

  private runWrite<T>(task: () => Promise<T>): Promise<T> {
    return this.dbProvider ? this.dbProvider.runSerializedAppWrite(task) : runSerializedAppWrite(task);
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus) {
    if (this.status !== status) {
      this.status = status;
      this.listeners.forEach(l => l(status));
    }
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public runUpload(): Promise<UploadRunResult> {
    if (this.uploadInFlight) {
      return this.uploadInFlight;
    }
    this.uploadInFlight = this._doUpload().finally(() => {
      this.uploadInFlight = null;
    });
    return this.uploadInFlight;
  }

  private async _doUpload(): Promise<UploadRunResult> {
    const emptyResult: UploadRunResult = {
      selectedCount: 0,
      acceptedCount: 0,
      retryableFailureCount: 0,
      permanentFailureCount: 0,
      pendingCount: 0,
      completedAt: this.clock.nowIso()
    };

    const state = await this.stateRepository.get(this.provider.providerId);
    if (state?.initializationState === "requires_initialization") {
      this.setStatus("requires_initialization");
      return emptyResult;
    }

    const connected = await this.provider.isConnected();
    if (!connected) {
      this.setStatus("disconnected");
      return emptyResult;
    }

    // Wait for the state, we need vehicleId
    const db = await this.openDb();
    const appState = await db.get('store', 'state');
    if (!appState || !appState.vehicleId) {
      db.close();
      this.setStatus("requires_initialization");
      return emptyResult;
    }
    const vehicleId = appState.vehicleId;

    // Load from Outbox
    const tx = db.transaction('outbox', 'readwrite');
    const outboxTx = tx.store;
    const allOutbox = await outboxTx.getAll();
    
    const nowIso = this.clock.nowIso();

    const selectedEntries: OutboxEntry[] = [];
    let pendingCount = 0;

    for (const entry of allOutbox) {
      let selectable = false;
      if (entry.status === "pending") {
        selectable = true;
      } else if (entry.status === "failed") {
        if (!entry.nextRetryAt || entry.nextRetryAt <= nowIso) {
          selectable = true;
        }
      } else if (entry.status === "uploading") {
        if (entry.leaseExpiresAt && entry.leaseExpiresAt <= nowIso) {
          selectable = true;
        }
      }

      if (selectable && selectedEntries.length < MAX_UPLOAD_BATCH_SIZE) {
        selectedEntries.push(entry);
      } else if (entry.status === "pending" || entry.status === "failed") {
        pendingCount++;
      }
    }

    if (selectedEntries.length === 0) {
      await tx.done;
      db.close();
      this.setStatus("idle");
      return { ...emptyResult, pendingCount };
    }

    this.setStatus("uploading");

    // Apply lease
    const leaseExpiresAtMs = this.clock.nowMs() + UPLOAD_LEASE_DURATION_MS;
    const leaseExpiresAt = new Date(leaseExpiresAtMs).toISOString();
    
    for (const entry of selectedEntries) {
      entry.status = "uploading";
      entry.leaseExpiresAt = leaseExpiresAt;
      await outboxTx.put(entry);
    }
    await tx.done;

    // Upload to provider
    const eventsToUpload = selectedEntries.map(e => e.event);
    try {
      const result = await this.provider.uploadEvents({
        vehicleId,
        events: eventsToUpload
      });

      // Process results
      const writeTx = db.transaction('outbox', 'readwrite');
      const writeStore = writeTx.store;

      let acceptedCount = 0;
      let retryableFailureCount = 0;
      let permanentFailureCount = 0;

      for (const entry of selectedEntries) {
        const eventId = entry.event.eventId;
        if (result.acceptedEventIds.includes(eventId)) {
          await writeStore.delete(eventId);
          acceptedCount++;
        } else {
          const rejection = result.rejectedEvents.find(r => r.eventId === eventId);
          if (rejection) {
            entry.lastError = rejection.reason;
            if (rejection.retryable) {
              entry.status = "failed";
              entry.retryCount = (entry.retryCount || 0) + 1;
              entry.nextRetryAt = this.calculateNextRetryAt(entry.retryCount);
              delete entry.leaseExpiresAt;
              await writeStore.put(entry);
              retryableFailureCount++;
            } else {
              entry.status = "failed";
              delete entry.nextRetryAt;
              delete entry.leaseExpiresAt;
              await writeStore.put(entry);
              permanentFailureCount++;
            }
          } else {
            // Shouldn't happen based on API, but fallback
            entry.status = "failed";
            entry.retryCount = (entry.retryCount || 0) + 1;
            entry.nextRetryAt = this.calculateNextRetryAt(entry.retryCount);
            delete entry.leaseExpiresAt;
            entry.lastError = "Unknown rejection";
            await writeStore.put(entry);
            retryableFailureCount++;
          }
        }
      }
      await writeTx.done;
      db.close();

      this.setStatus("idle");

      return {
        selectedCount: selectedEntries.length,
        acceptedCount,
        retryableFailureCount,
        permanentFailureCount,
        pendingCount, // approximation
        completedAt: this.clock.nowIso()
      };

    } catch (err: any) {
      // Total failure
      const code = err.code || "UNKNOWN";
      
      const writeTx = db.transaction('outbox', 'readwrite');
      const writeStore = writeTx.store;

      for (const entry of selectedEntries) {
        entry.status = "failed";
        entry.lastError = err.message || "Provider error";
        delete entry.leaseExpiresAt;
        
        if (code === "ACCESS_REVOKED") {
          delete entry.nextRetryAt;
        } else if (code !== "NOT_CONNECTED") {
          entry.retryCount = (entry.retryCount || 0) + 1;
          entry.nextRetryAt = this.calculateNextRetryAt(entry.retryCount);
        } else {
           // Not connected means network down, wait and retry without increasing retryCount? 
           // Requirements say: "bei temporären Fehlern nextRetryAt setzen".
           entry.retryCount = (entry.retryCount || 0) + 1;
           entry.nextRetryAt = this.calculateNextRetryAt(entry.retryCount);
        }
        await writeStore.put(entry);
      }
      await writeTx.done;
      db.close();

      if (code === "ACCESS_REVOKED") {
        this.setStatus("access_revoked");
      } else if (code === "NOT_CONNECTED") {
        this.setStatus("disconnected");
      } else {
        this.setStatus("error");
      }

      return {
        selectedCount: selectedEntries.length,
        acceptedCount: 0,
        retryableFailureCount: selectedEntries.length,
        permanentFailureCount: 0,
        pendingCount,
        completedAt: this.clock.nowIso()
      };
    }
  }

  public runDownload(): Promise<DownloadRunResult> {
    if (this.downloadInFlight) {
      return this.downloadInFlight;
    }
    this.downloadInFlight = this._doDownload().finally(() => {
      this.downloadInFlight = null;
    });
    return this.downloadInFlight;
  }

  private async _doDownload(): Promise<DownloadRunResult> {
    const emptyResult: DownloadRunResult = {
      downloadedCount: 0,
      appliedCount: 0,
      alreadyAppliedCount: 0,
      deferredCount: 0,
      conflictCount: 0,
      pageCount: 0,
      completedAt: this.clock.nowIso()
    };

    const state = await this.stateRepository.get(this.provider.providerId);
    if (state?.initializationState === "requires_initialization") {
      this.setStatus("requires_initialization");
      return emptyResult;
    }

    const connected = await this.provider.isConnected();
    if (!connected) {
      this.setStatus("disconnected");
      return emptyResult;
    }

    const db = await this.openDb();
    const appState = await db.get('store', 'state');
    if (!appState || !appState.vehicleId) {
      db.close();
      this.setStatus("requires_initialization");
      return emptyResult;
    }
    const vehicleId = appState.vehicleId;
    db.close();

    this.setStatus("downloading");

    let currentCursor = state?.remoteCursor;
    let hasMore = true;
    let pageCount = 0;
    const finalResult = { ...emptyResult };

    try {
      while (hasMore) {
        const page = await this.provider.downloadChanges({
          vehicleId,
          cursor: currentCursor,
          limit: DOWNLOAD_PAGE_SIZE
        });


        if (page.events.length === 0 && !page.hasMore) {
          break;
        }

        if (page.events.length > 0) {
          if (!page.newCursor || page.newCursor === currentCursor) {
             throw new Error("Missing or non-advancing newCursor on non-empty page");
          }
          await this.runWrite(async () => {
            const pageDb = await this.openDb();
            const tx = pageDb.transaction(['store', 'eventLog', 'appliedEvents', 'deferredEvents', 'syncConflicts', 'syncState'], 'readwrite');
            tx.done.catch(() => {}); // Prevent unhandled rejection on abort
            try {
              let localState: AppState = await tx.objectStore('store').get('state');
              if (!localState || localState.vehicleId !== vehicleId) {
                throw new Error("Invalid local state during download");
              }
              
              let pageAppliedCount = 0;
              let pageDeferredCount = 0;
              let pageConflictCount = 0;
              let pageAlreadyAppliedCount = 0;

              for (const remoteEvent of page.events) {
                if (remoteEvent.event.vehicleId !== vehicleId) {
                  throw new Error("Abweichende vehicleId wird abgelehnt");
                }
                
                const alreadyApplied = await tx.objectStore('appliedEvents').get(remoteEvent.event.eventId);
                if (alreadyApplied) {
                  pageAlreadyAppliedCount++;
                  continue;
                }

                const inventory = localState.inventory || [];
                const itemIndex = inventory.findIndex(i => i.id === remoteEvent.event.itemId);
                const currentItem = itemIndex >= 0 ? inventory[itemIndex] : undefined;

                const reduceResult = reduceInventoryEvent(currentItem, remoteEvent.event);
                if (reduceResult.status === 'applied') {
                  if (itemIndex >= 0) {
                    inventory[itemIndex] = reduceResult.item;
                  } else {
                    inventory.push(reduceResult.item);
                  }
                  localState.inventory = inventory;
                  localState.inventoryRevision = (localState.inventoryRevision || 0) + 1;

                  await tx.objectStore('eventLog').put({ event: remoteEvent.event, source: 'remote', recordedAt: this.clock.nowIso() });
                  await tx.objectStore('appliedEvents').put({ eventId: remoteEvent.event.eventId, appliedAt: this.clock.nowIso() });
                  pageAppliedCount++;
                } else if (reduceResult.status === 'deferred') {
                  await tx.objectStore('deferredEvents').put({
                    event: remoteEvent.event,
                    remoteMetadata: remoteEvent.remoteMetadata,
                    reason: reduceResult.reason,
                    retryCount: 0,
                    firstDeferredAt: this.clock.nowIso(),
                    lastAttemptAt: this.clock.nowIso()
                  });
                  pageDeferredCount++;
                } else if (reduceResult.status === 'conflict') {
                  await tx.objectStore('syncConflicts').put({
                    conflictId: remoteEvent.event.eventId,
                    event: remoteEvent.event,
                    currentItem,
                    reason: reduceResult.reason,
                    status: 'open',
                    createdAt: this.clock.nowIso()
                  });
                  pageConflictCount++;
                } else {
                  throw new Error(`Event rejected: ${reduceResult.reason}`);
                }
              }

              if (pageAppliedCount > 0) {
                await tx.objectStore('store').put(localState, 'state');
              }

              const localSyncState = await tx.objectStore('syncState').get(this.provider.providerId) || { providerId: this.provider.providerId };
              localSyncState.remoteCursor = page.newCursor;
              localSyncState.lastSuccessfulSyncAt = this.clock.nowIso();
              await tx.objectStore('syncState').put(localSyncState);

              await tx.done;
              
              finalResult.downloadedCount += page.events.length;
              finalResult.appliedCount += pageAppliedCount;
              finalResult.alreadyAppliedCount += pageAlreadyAppliedCount;
              finalResult.deferredCount += pageDeferredCount;
              finalResult.conflictCount += pageConflictCount;
            } catch(err) {
              tx.abort();
              throw err;
            } finally {
              pageDb.close();
            }
          });
        } else if (page.newCursor !== currentCursor) {
          await this.runWrite(async () => {
            const pageDb = await this.openDb();
            const tx = pageDb.transaction(['syncState'], 'readwrite');
            tx.done.catch(() => {});
            try {
              const localSyncState = await tx.objectStore('syncState').get(this.provider.providerId) || { providerId: this.provider.providerId };
              localSyncState.remoteCursor = page.newCursor;
              localSyncState.lastSuccessfulSyncAt = this.clock.nowIso();
              await tx.objectStore('syncState').put(localSyncState);
              await tx.done;
            } catch(err) {
              tx.abort();
              throw err;
            } finally {
              pageDb.close();
            }
          });
        }

        pageCount++;

        if (page.hasMore && page.newCursor === currentCursor) {
          const err: any = new Error("Paging stagnation: hasMore is true but cursor did not advance.");
          err.code = "CURSOR_STAGNATION";
          throw err;
        }

        currentCursor = page.newCursor;
        hasMore = page.hasMore;
      }

      this.setStatus("idle");
      finalResult.pageCount = pageCount;
      finalResult.newCursor = currentCursor;
      finalResult.completedAt = this.clock.nowIso();
      return finalResult;

    } catch (err: any) {
      const code = err.code || "UNKNOWN";
      if (code === "ACCESS_REVOKED") {
        this.setStatus("access_revoked");
      } else if (code === "NOT_CONNECTED") {
        this.setStatus("disconnected");
      } else {
        this.setStatus("error");
      }
      
      finalResult.pageCount = pageCount;
      finalResult.newCursor = currentCursor;
      finalResult.completedAt = this.clock.nowIso();
      return finalResult;
    }
  }

  private calculateNextRetryAt(retryCount: number): string {
    const delay = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * Math.pow(2, retryCount - 1));
    const jitter = this.random() * delay * 0.2; // 0 to 20% jitter
    const nextTimeMs = this.clock.nowMs() + delay + jitter;
    return new Date(nextTimeMs).toISOString();
  }
}
