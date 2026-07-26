import type {
  SyncProvider,
  InitializeRemoteStoreResult,
  UploadEventsResult,
  DownloadChangesResult
} from './syncTypes';
import type { InventoryEvent } from '../types';
import { SyncProviderError } from './syncProviderError';

export const SYNC_BASE_URL = 'https://g4c-sync.tuffsteinzwerg1.workers.dev';

export class CloudflareSyncProvider implements SyncProvider {
  readonly providerId = 'cloudflare';

  private connected = false;
  private baseUrl: string;

  constructor(baseUrl: string = SYNC_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async isConnected(): Promise<boolean> {
    if (!this.connected) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return true;
  }

  private ensureUsable(): void {
    if (!this.connected) {
      throw new SyncProviderError('NOT_CONNECTED', 'Nicht verbunden', true);
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new SyncProviderError('OFFLINE', 'Kein Netz', true);
    }
  }

  private async request(path: string, init?: RequestInit): Promise<any> {
    this.ensureUsable();
    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, init);
    } catch (e) {
      throw new SyncProviderError('REMOTE_TEMPORARY_ERROR', 'Server nicht erreichbar', true);
    }
    if (response.status >= 500) {
      throw new SyncProviderError('REMOTE_TEMPORARY_ERROR', 'Serverfehler ' + response.status, true);
    }
    if (!response.ok) {
      throw new SyncProviderError('REMOTE_PERMANENT_ERROR', 'Anfrage abgelehnt (' + response.status + ')', false);
    }
    try {
      return await response.json();
    } catch (e) {
      throw new SyncProviderError('REMOTE_TEMPORARY_ERROR', 'Ungueltige Antwort', true);
    }
  }

  async initializeRemoteStore(input: { vehicleId: string }): Promise<InitializeRemoteStoreResult> {
    if (!input || !input.vehicleId) {
      throw new SyncProviderError('INVALID_EVENT', 'vehicleId fehlt', false);
    }
    const data = await this.request('/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId: input.vehicleId })
    });
    return {
      remoteStoreId: data.remoteStoreId,
      initialCursor: data.initialCursor
    };
  }

  async uploadEvents(input: { vehicleId: string; events: InventoryEvent[] }): Promise<UploadEventsResult> {
    const data = await this.request('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId: input.vehicleId, events: input.events })
    });
    return {
      acceptedEventIds: Array.isArray(data.acceptedEventIds) ? data.acceptedEventIds : [],
      rejectedEvents: Array.isArray(data.rejectedEvents) ? data.rejectedEvents : []
    };
  }

  async downloadChanges(input: { vehicleId: string; cursor?: string; limit?: number }): Promise<DownloadChangesResult> {
    const params = new URLSearchParams();
    params.set('vehicleId', input.vehicleId);
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.limit) params.set('limit', String(input.limit));
    const data = await this.request('/download?' + params.toString(), { method: 'GET' });
    return {
      events: Array.isArray(data.events) ? data.events : [],
      newCursor: data.newCursor,
      hasMore: !!data.hasMore
    };
  }
}
