import { 
  SyncProvider, 
  InitializeRemoteStoreResult, 
  UploadEventsResult, 
  DownloadChangesResult, 
  RemoteInventoryEvent,
  SyncErrorCode
} from './syncTypes';
import { InventoryEvent } from '../types';
import { SyncProviderError } from './syncProviderError';

export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) {
    return true;
  }
  if (obj1 == null || typeof obj1 !== 'object' || obj2 == null || typeof obj2 !== 'object') {
    return false;
  }
  
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }
  
  if (Array.isArray(obj1) || Array.isArray(obj2)) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(obj2, key)) {
      return false;
    }
    if (!deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

export interface Clock {
  nowIso(): string;
}

export class DefaultClock implements Clock {
  nowIso(): string {
    return new Date().toISOString();
  }
}

export interface LoopbackFailurePolicy {
  rejectUploadEvent?: (event: InventoryEvent) => { reason: string; retryable: boolean } | undefined;
  failNextUpload?: boolean;
  failNextDownload?: boolean;
}

interface RemoteVehicleStore {
  remoteStoreId: string;
  sequence: number;
  events: RemoteInventoryEvent[];
  eventIndex: Map<string, RemoteInventoryEvent>;
}

export class InMemoryLoopbackBackend {
  private stores = new Map<string, RemoteVehicleStore>();

  public getOrCreateStore(vehicleId: string): RemoteVehicleStore {
    let store = this.stores.get(vehicleId);
    if (!store) {
      store = {
        remoteStoreId: `store_${vehicleId}_${Math.random().toString(36).substring(7)}`,
        sequence: 0,
        events: [],
        eventIndex: new Map(),
      };
      this.stores.set(vehicleId, store);
    }
    return store;
  }

  public getStore(vehicleId: string): RemoteVehicleStore | undefined {
    return this.stores.get(vehicleId);
  }
}

export class LoopbackSyncProvider implements SyncProvider {
  readonly providerId = "loopback";
  
  private connected = false;
  private accessRevoked = false;
  private backend: InMemoryLoopbackBackend;
  private failurePolicy: LoopbackFailurePolicy;
  private clock: Clock;

  constructor(
    backend: InMemoryLoopbackBackend, 
    failurePolicy: LoopbackFailurePolicy = {},
    clock: Clock = new DefaultClock()
  ) {
    this.backend = backend;
    this.failurePolicy = failurePolicy;
    this.clock = clock;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  setAccessRevoked(revoked: boolean) {
    this.accessRevoked = revoked;
  }
  
  setFailurePolicy(policy: LoopbackFailurePolicy) {
    this.failurePolicy = policy;
  }

  private checkConnection() {
    if (this.accessRevoked) {
      throw new SyncProviderError("ACCESS_REVOKED", "Access revoked", false);
    }
    if (!this.connected) {
      throw new SyncProviderError("NOT_CONNECTED", "Provider is disconnected", true);
    }
  }

  async initializeRemoteStore(input: { vehicleId: string }): Promise<InitializeRemoteStoreResult> {
    this.checkConnection();
    if (!input.vehicleId) {
      throw new SyncProviderError("INVALID_EVENT", "vehicleId is required", false);
    }
    const store = this.backend.getOrCreateStore(input.vehicleId);
    return {
      remoteStoreId: store.remoteStoreId,
      initialCursor: store.sequence > 0 ? String(store.sequence) : undefined
    };
  }

  async uploadEvents(input: { vehicleId: string; events: InventoryEvent[] }): Promise<UploadEventsResult> {
    this.checkConnection();
    
    if (this.failurePolicy.failNextUpload) {
      this.failurePolicy.failNextUpload = false;
      throw new SyncProviderError("REMOTE_TEMPORARY_ERROR", "Simulated upload failure", true);
    }

    const store = this.backend.getStore(input.vehicleId);
    if (!store) {
      throw new SyncProviderError("INITIALIZATION_REQUIRED", "Remote store not initialized", false);
    }

    const acceptedEventIds: string[] = [];
    const rejectedEvents: Array<{ eventId: string; reason: string; retryable: boolean }> = [];

    for (const event of input.events) {
      if (!event.eventId) {
        rejectedEvents.push({ eventId: "unknown", reason: "Missing eventId", retryable: false });
        continue;
      }

      if (event.vehicleId !== input.vehicleId) {
        rejectedEvents.push({ eventId: event.eventId, reason: "Vehicle ID mismatch", retryable: false });
        continue;
      }
      
      if (!event.schemaVersion || event.schemaVersion > 1) { 
        rejectedEvents.push({ eventId: event.eventId, reason: "Unsupported schema version", retryable: false });
        continue;
      }

      const policyRejection = this.failurePolicy.rejectUploadEvent?.(event);
      if (policyRejection) {
        rejectedEvents.push({ eventId: event.eventId, reason: policyRejection.reason, retryable: policyRejection.retryable });
        continue;
      }

      const existingEvent = store.eventIndex.get(event.eventId);
      if (existingEvent) {
        if (deepEqual(existingEvent.event, event)) {
          acceptedEventIds.push(event.eventId);
          continue; 
        } else {
          rejectedEvents.push({ eventId: event.eventId, reason: "Event ID collision with different content", retryable: false });
          continue;
        }
      }

      store.sequence++;
      const remoteEvent: RemoteInventoryEvent = {
        event: typeof structuredClone === 'function' ? structuredClone(event) : JSON.parse(JSON.stringify(event)), // Clone event
        remoteMetadata: {
          remoteEventId: event.eventId,
          receivedAt: this.clock.nowIso(),
          providerSequence: String(store.sequence)
        }
      };

      store.events.push(remoteEvent);
      store.eventIndex.set(event.eventId, remoteEvent);
      acceptedEventIds.push(event.eventId);
    }

    return { acceptedEventIds, rejectedEvents };
  }

  async downloadChanges(input: { vehicleId: string; cursor?: string; limit?: number }): Promise<DownloadChangesResult> {
    this.checkConnection();

    if (this.failurePolicy.failNextDownload) {
      this.failurePolicy.failNextDownload = false;
      throw new SyncProviderError("REMOTE_TEMPORARY_ERROR", "Simulated download failure", true);
    }

    const store = this.backend.getStore(input.vehicleId);
    if (!store) {
      throw new SyncProviderError("INITIALIZATION_REQUIRED", "Remote store not initialized", false);
    }

    let startSequence = 0;
    if (input.cursor && input.cursor !== "0") {
      const parsed = parseInt(input.cursor, 10);
      if (isNaN(parsed)) {
        throw new SyncProviderError("INVALID_EVENT", "Invalid cursor format", false);
      } else {
        startSequence = parsed;
      }
    }

    let limit = 1000;
    if (input.limit !== undefined) {
      if (typeof input.limit !== 'number' || isNaN(input.limit) || !Number.isFinite(input.limit) || input.limit <= 0) {
        throw new SyncProviderError("INVALID_EVENT", "Invalid limit", false);
      }
      limit = input.limit;
    }
    
    // Filter events after the cursor
    const newEvents = store.events.filter(e => parseInt(e.remoteMetadata.providerSequence!) > startSequence);
    
    const page = newEvents.slice(0, limit);
    const hasMore = newEvents.length > limit;
    
    const newCursor = page.length > 0 ? page[page.length - 1].remoteMetadata.providerSequence : (input.cursor || "0");

    return {
      events: typeof structuredClone === 'function' ? structuredClone(page) : JSON.parse(JSON.stringify(page)), // Return copies
      newCursor,
      hasMore
    };
  }
}
