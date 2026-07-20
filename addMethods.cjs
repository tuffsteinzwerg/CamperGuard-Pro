const fs = require('fs');
let code = fs.readFileSync('src/lib/syncCoordinator.ts', 'utf8');

const methodsToAdd = `
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

    await runSerializedAppWrite(async () => {
      const db = await openAppDatabase();
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
          if (entry.event.vehicleId !== vehicleId) continue;
          if (entry.status === 'permanent_failure') continue;

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
`;

code = code.replace(/export class SyncCoordinator \{/, 'export class SyncCoordinator {\n' + methodsToAdd);
fs.writeFileSync('src/lib/syncCoordinator.ts', code);
