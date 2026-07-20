// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryLoopbackBackend, LoopbackSyncProvider, Clock } from '../loopbackProvider';
import { InventoryEvent } from '../../types';

class MockClock implements Clock {
  private currentTime = '2023-01-01T00:00:00.000Z';
  nowIso(): string {
    return this.currentTime;
  }
  setTime(time: string) {
    this.currentTime = time;
  }
}

describe('LoopbackSyncProvider', () => {
  let backend: InMemoryLoopbackBackend;
  let providerA: LoopbackSyncProvider;
  let providerB: LoopbackSyncProvider;
  let clock: MockClock;

  const createEvent = (id: string, vehicleId: string = 'v1'): InventoryEvent => ({
    eventId: id,
    vehicleId,
    type: 'item_created',
    itemId: `item_${id}`,
    actorId: 'user1',
    deviceId: 'device1',
    clientCreatedAt: '2023-01-01T00:00:00.000Z',
    schemaVersion: 1,
    payload: { name: 'Test', quantity: 1, unit: 'Stk' } as any
  });

  beforeEach(() => {
    backend = new InMemoryLoopbackBackend();
    clock = new MockClock();
    providerA = new LoopbackSyncProvider(backend, {}, clock);
    providerB = new LoopbackSyncProvider(backend, {}, clock);
  });

  describe('Initialization', () => {
    it('creates a remote store on initialization', async () => {
      await providerA.connect();
      const res = await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      expect(res.remoteStoreId).toBeDefined();
      expect(res.initialCursor).toBeUndefined();
    });

    it('returns the same remoteStoreId for repeated initialization of the same vehicleId', async () => {
      await providerA.connect();
      const res1 = await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      const res2 = await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      expect(res1.remoteStoreId).toEqual(res2.remoteStoreId);
    });

    it('re-initialization does not delete existing events', async () => {
      await providerA.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1')] });
      
      const initRes = await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      expect(initRes.initialCursor).toBe('1');
      
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events).toHaveLength(1);
    });

    it('creates separate stores for different vehicles', async () => {
      await providerA.connect();
      const res1 = await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      const res2 = await providerA.initializeRemoteStore({ vehicleId: 'v2' });
      expect(res1.remoteStoreId).not.toEqual(res2.remoteStoreId);
    });

    it('isolates events from different vehicles', async () => {
      await providerA.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      await providerA.initializeRemoteStore({ vehicleId: 'v2' });
      
      await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1', 'v1')] });
      
      const dl1 = await providerA.downloadChanges({ vehicleId: 'v1' });
      const dl2 = await providerA.downloadChanges({ vehicleId: 'v2' });
      
      expect(dl1.events).toHaveLength(1);
      expect(dl2.events).toHaveLength(0);
    });
  });

  describe('Connection', () => {
    it('rejects operations when disconnected with NOT_CONNECTED', async () => {
      try {
        await providerA.initializeRemoteStore({ vehicleId: 'v1' });
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('NOT_CONNECTED');
      }
      try {
        await providerA.uploadEvents({ vehicleId: 'v1', events: [] });
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('NOT_CONNECTED');
      }
      try {
        await providerA.downloadChanges({ vehicleId: 'v1' });
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('NOT_CONNECTED');
      }
    });

    it('allows operations after connect', async () => {
      await providerA.connect();
      await expect(providerA.initializeRemoteStore({ vehicleId: 'v1' })).resolves.toBeDefined();
    });

    it('rejects operations again after disconnect', async () => {
      await providerA.connect();
      await providerA.disconnect();
      try {
        await providerA.initializeRemoteStore({ vehicleId: 'v1' });
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('NOT_CONNECTED');
      }
    });
  });

  describe('Upload', () => {
    beforeEach(async () => {
      await providerA.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
    });

    it('stores a batch of valid events completely', async () => {
      const res = await providerA.uploadEvents({
        vehicleId: 'v1',
        events: [createEvent('e1'), createEvent('e2')]
      });
      expect(res.acceptedEventIds).toEqual(['e1', 'e2']);
      expect(res.rejectedEvents).toHaveLength(0);
      
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events).toHaveLength(2);
    });

    it('does not change store or sequence for an empty batch', async () => {
      await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1')] });
      const dl1 = await providerA.downloadChanges({ vehicleId: 'v1' });

      await providerA.uploadEvents({ vehicleId: 'v1', events: [] });
      const dl2 = await providerA.downloadChanges({ vehicleId: 'v1' });

      expect(dl2.events).toHaveLength(1);
      expect(dl2.newCursor).toBe(dl1.newCursor);
    });

    it('assigns exactly one sequence to each new event', async () => {
      await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1'), createEvent('e2')] });
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events[0].remoteMetadata.providerSequence).toBe('1');
      expect(dl.events[1].remoteMetadata.providerSequence).toBe('2');
    });

    it('maintains technical input order', async () => {
      await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1'), createEvent('e2')] });
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events[0].event.eventId).toBe('e1');
      expect(dl.events[1].event.eventId).toBe('e2');
    });

    it('does not mutate the input array or events', async () => {
      const inputEvents = [createEvent('e1')];
      const inputCopy = JSON.parse(JSON.stringify(inputEvents));
      await providerA.uploadEvents({ vehicleId: 'v1', events: inputEvents });
      expect(inputEvents).toEqual(inputCopy);
    });

    it('does not mutate backend when input event is mutated after upload', async () => {
      const e1 = createEvent('e1');
      (e1 as any).payload = { value: 'original' };
      await providerA.uploadEvents({ vehicleId: 'v1', events: [e1] });
      
      // Mutate
      (e1 as any).payload.value = 'mutated';

      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect((dl.events[0].event as any).payload.value).toBe('original');
    });

    it('does not mutate backend when downloaded event is mutated', async () => {
      const e1 = createEvent('e1');
      (e1 as any).payload = { value: 'original' };
      await providerA.uploadEvents({ vehicleId: 'v1', events: [e1] });
      
      const dl1 = await providerA.downloadChanges({ vehicleId: 'v1' });
      (dl1.events[0].event as any).payload.value = 'mutated';

      const dl2 = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect((dl2.events[0].event as any).payload.value).toBe('original');
    });
  });

  describe('Deduplication', () => {
    beforeEach(async () => {
      await providerA.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
    });

    it('does not store identical events twice', async () => {
      const ev = createEvent('e1');
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev] });
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev] });
      
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events).toHaveLength(1);
    });

    it('reports repeated upload as accepted', async () => {
      const ev = createEvent('e1');
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev] });
      const res = await providerA.uploadEvents({ vehicleId: 'v1', events: [ev] });
      expect(res.acceptedEventIds).toContain('e1');
    });

    it('does not increase the sequence for duplicates', async () => {
      const ev = createEvent('e1');
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev] });
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev] });
      await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e2')] });
      
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events[1].remoteMetadata.providerSequence).toBe('2');
    });

    it('leaves receivedAt unchanged on duplicate', async () => {
      clock.setTime('2023-01-01T00:00:00.000Z');
      const ev = createEvent('e1');
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev] });
      
      clock.setTime('2023-01-02T00:00:00.000Z');
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev] });
      
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events[0].remoteMetadata.receivedAt).toBe('2023-01-01T00:00:00.000Z');
    });

    it('accepts identical event with different object key order as duplicate', async () => {
      const e1 = createEvent('e1');
      (e1 as any).payload = { a: 1, b: 2 };
      await providerA.uploadEvents({ vehicleId: 'v1', events: [e1] });
      
      const dl1 = await providerA.downloadChanges({ vehicleId: 'v1' });
      const receivedAt1 = dl1.events[0].remoteMetadata.receivedAt;
      const sequence1 = dl1.newCursor;

      const e1_different_order = createEvent('e1');
      (e1_different_order as any).payload = { b: 2, a: 1 }; // Different key order
      
      const res = await providerA.uploadEvents({ vehicleId: 'v1', events: [e1_different_order] });
      expect(res.acceptedEventIds).toEqual(['e1']);

      const dl2 = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl2.events).toHaveLength(1);
      expect(dl2.events[0].remoteMetadata.receivedAt).toBe(receivedAt1);
      expect(dl2.newCursor).toBe(sequence1);
    });
  });

  describe('Collision', () => {
    beforeEach(async () => {
      await providerA.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
    });

    it('permanently rejects different content with same eventId', async () => {
      const ev1 = createEvent('e1');
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev1] });
      
      const ev2 = createEvent('e1');
      ev2.itemId = 'different_item';
      const res = await providerA.uploadEvents({ vehicleId: 'v1', events: [ev2] });
      
      expect(res.rejectedEvents).toHaveLength(1);
      expect(res.rejectedEvents[0].eventId).toBe('e1');
      expect(res.rejectedEvents[0].retryable).toBe(false);
    });

    it('leaves existing event unchanged on collision', async () => {
      const ev1 = createEvent('e1');
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev1] });
      
      const ev2 = createEvent('e1');
      ev2.itemId = 'different_item';
      await providerA.uploadEvents({ vehicleId: 'v1', events: [ev2] });
      
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events[0].event.itemId).toBe('item_e1');
    });
  });

  describe('Partial Errors', () => {
    beforeEach(async () => {
      await providerA.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
    });

    it('rejects exactly one event via failure policy', async () => {
      providerA.setFailurePolicy({
        rejectUploadEvent: (event) => event.eventId === 'e2' ? { reason: 'Policy rejection', retryable: true } : undefined
      });
      
      const res = await providerA.uploadEvents({
        vehicleId: 'v1',
        events: [createEvent('e1'), createEvent('e2'), createEvent('e3')]
      });
      
      expect(res.acceptedEventIds).toEqual(['e1', 'e3']);
      expect(res.rejectedEvents).toHaveLength(1);
      expect(res.rejectedEvents[0].eventId).toBe('e2');
      expect(res.rejectedEvents[0].retryable).toBe(true);
      
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events).toHaveLength(2);
    });
  });

  describe('Cursor and Paging', () => {
    beforeEach(async () => {
      await providerA.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      await providerA.uploadEvents({
        vehicleId: 'v1',
        events: [createEvent('e1'), createEvent('e2'), createEvent('e3'), createEvent('e4')]
      });
    });

    it('delivers first events without cursor', async () => {
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events[0].event.eventId).toBe('e1');
    });

    it('delivers only later events with cursor', async () => {
      const dl = await providerA.downloadChanges({ vehicleId: 'v1', cursor: '2' });
      expect(dl.events[0].event.eventId).toBe('e3');
    });

    it('limits the page size', async () => {
      const dl = await providerA.downloadChanges({ vehicleId: 'v1', limit: 2 });
      expect(dl.events).toHaveLength(2);
      expect(dl.hasMore).toBe(true);
    });

    it('sets newCursor to the sequence of the last delivered event', async () => {
      const dl = await providerA.downloadChanges({ vehicleId: 'v1', limit: 2 });
      expect(dl.newCursor).toBe('2');
    });

    it('returns hasMore correctly', async () => {
      const dl = await providerA.downloadChanges({ vehicleId: 'v1', limit: 4 });
      expect(dl.hasMore).toBe(false);
    });

    it('delivers each event exactly once across multiple pages', async () => {
      const dl1 = await providerA.downloadChanges({ vehicleId: 'v1', limit: 2 });
      const dl2 = await providerA.downloadChanges({ vehicleId: 'v1', cursor: dl1.newCursor, limit: 2 });
      
      expect(dl1.events.map(e => e.event.eventId)).toEqual(['e1', 'e2']);
      expect(dl2.events.map(e => e.event.eventId)).toEqual(['e3', 'e4']);
    });

    it('does not deliver duplicates when there are no new events', async () => {
      const dl1 = await providerA.downloadChanges({ vehicleId: 'v1' });
      const dl2 = await providerA.downloadChanges({ vehicleId: 'v1', cursor: dl1.newCursor });
      expect(dl2.events).toHaveLength(0);
    });

    it('delivers empty page for cursor above sequence', async () => {
      const dl = await providerA.downloadChanges({ vehicleId: 'v1', cursor: '99999' });
      expect(dl.events).toHaveLength(0);
      expect(dl.hasMore).toBe(false);
    });

    it('rejects limit 0', async () => {
      try {
        await providerA.downloadChanges({ vehicleId: 'v1', limit: 0 });
        expect.fail('Should throw');
      } catch(e: any) {
        expect(e.code).toBe('INVALID_EVENT');
      }
    });

    it('rejects negative limit', async () => {
      try {
        await providerA.downloadChanges({ vehicleId: 'v1', limit: -5 });
        expect.fail('Should throw');
      } catch(e: any) {
        expect(e.code).toBe('INVALID_EVENT');
      }
    });

    it('rejects NaN limit', async () => {
      try {
        await providerA.downloadChanges({ vehicleId: 'v1', limit: NaN });
        expect.fail('Should throw');
      } catch(e: any) {
        expect(e.code).toBe('INVALID_EVENT');
      }
    });

    it('rejects Infinity limit', async () => {
      try {
        await providerA.downloadChanges({ vehicleId: 'v1', limit: Infinity });
        expect.fail('Should throw');
      } catch(e: any) {
        expect(e.code).toBe('INVALID_EVENT');
      }
    });
  });

  describe('Two simulated devices', () => {
    it('synchronizes events between two instances', async () => {
      await providerA.connect();
      await providerB.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      await providerB.initializeRemoteStore({ vehicleId: 'v1' });

      await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1'), createEvent('e2')] });
      
      const dlB1 = await providerB.downloadChanges({ vehicleId: 'v1' });
      expect(dlB1.events).toHaveLength(2);
      
      await providerB.uploadEvents({ vehicleId: 'v1', events: [createEvent('e3')] });
      
      const dlA1 = await providerA.downloadChanges({ vehicleId: 'v1', cursor: '2' });
      expect(dlA1.events).toHaveLength(1);
      expect(dlA1.events[0].event.eventId).toBe('e3');
    });
  });

  describe('Errors', () => {
    beforeEach(async () => {
      await providerA.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
    });

    it('fails next upload with temporary error', async () => {
      providerA.setFailurePolicy({ failNextUpload: true });
      try {
        await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1')] });
        expect.fail('Should throw');
      } catch (e: any) {
        expect(e.code).toBe('REMOTE_TEMPORARY_ERROR');
      }
    });

    it('does not store any events during a temporary error batch', async () => {
      providerA.setFailurePolicy({ failNextUpload: true });
      try {
        await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1')] });
      } catch (e) {}
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events).toHaveLength(0);
    });

    it('allows successful upload after temporary error', async () => {
      providerA.setFailurePolicy({ failNextUpload: true });
      try {
        await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1')] });
      } catch (e) {}
      
      const res = await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1')] });
      expect(res.acceptedEventIds).toHaveLength(1);
    });

    it('does not mutate backend during failNextDownload', async () => {
      await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1')] });
      providerA.setFailurePolicy({ failNextDownload: true });
      try {
        await providerA.downloadChanges({ vehicleId: 'v1' });
        expect.fail('Should throw');
      } catch (e: any) {
        expect(e.code).toBe('REMOTE_TEMPORARY_ERROR');
      }
      
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events).toHaveLength(1);
    });

    it('rejects invalid cursor format', async () => {
      try {
        await providerA.downloadChanges({ vehicleId: 'v1', cursor: 'invalid' });
        expect.fail('Should throw');
      } catch (e: any) {
        expect(e.code).toBe('INVALID_EVENT');
      }
    });

    it('rejects invalid event lacking vehicleId', async () => {
      const res = await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1', 'v2')] });
      expect(res.rejectedEvents[0].reason).toMatch(/mismatch/);
    });

    it('rejects unsupported schemaVersion', async () => {
      const ev = createEvent('e1');
      ev.schemaVersion = 2;
      const res = await providerA.uploadEvents({ vehicleId: 'v1', events: [ev] });
      expect(res.rejectedEvents[0].reason).toMatch(/Unsupported/);
    });
  });

  describe('Access Revocation', () => {
    beforeEach(async () => {
      await providerA.connect();
      await providerA.initializeRemoteStore({ vehicleId: 'v1' });
      await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e1')] });
    });

    it('results in ACCESS_REVOKED for all operations', async () => {
      providerA.setAccessRevoked(true);
      try {
        await providerA.initializeRemoteStore({ vehicleId: 'v1' });
        expect.fail('Should throw');
      } catch (e: any) {
        expect(e.code).toBe('ACCESS_REVOKED');
      }
      try {
        await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e2')] });
        expect.fail('Should throw');
      } catch (e: any) {
        expect(e.code).toBe('ACCESS_REVOKED');
      }
      try {
        await providerA.downloadChanges({ vehicleId: 'v1' });
        expect.fail('Should throw');
      } catch (e: any) {
        expect(e.code).toBe('ACCESS_REVOKED');
      }
    });

    it('stores no events while revoked', async () => {
      providerA.setAccessRevoked(true);
      try {
        await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e2')] });
      } catch (e) {}
      providerA.setAccessRevoked(false);
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events).toHaveLength(1);
    });

    it('leaves existing events intact', async () => {
      providerA.setAccessRevoked(true);
      providerA.setAccessRevoked(false);
      const dl = await providerA.downloadChanges({ vehicleId: 'v1' });
      expect(dl.events).toHaveLength(1);
    });

    it('resumes operations after unrevoking', async () => {
      providerA.setAccessRevoked(true);
      providerA.setAccessRevoked(false);
      const res = await providerA.uploadEvents({ vehicleId: 'v1', events: [createEvent('e2')] });
      expect(res.acceptedEventIds).toHaveLength(1);
    });
  });
});
