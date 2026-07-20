import { SyncableInventoryItem, InventoryEvent } from '../types';

export type EventApplyResult =
  | { status: "applied"; item: SyncableInventoryItem }
  | { status: "deferred"; reason: string }
  | { status: "conflict"; reason: string }
  | { status: "rejected"; reason: string };

export function reduceInventoryEvent(
  currentItem: SyncableInventoryItem | undefined,
  event: InventoryEvent
): EventApplyResult {
  if (!currentItem && event.type !== 'item_created') {
    return { status: "deferred", reason: "Item not found" };
  }

  switch (event.type) {
    case 'item_created': {
      if (currentItem) {
        return { status: "rejected", reason: "Item already exists" };
      }
      return {
        status: "applied",
        item: {
          ...event.payload,
          id: event.itemId,
          version: 1
        } as SyncableInventoryItem
      };
    }

    case 'quantity_delta': {
      return {
        status: "applied",
        item: {
          ...currentItem!,
          quantity: currentItem!.quantity + event.payload.delta,
          version: currentItem!.version + 1
        }
      };
    }

    case 'item_updated': {
      if (event.baseItemVersion !== undefined && currentItem!.version !== event.baseItemVersion) {
        return { status: "conflict", reason: "Base version mismatch" };
      }
      return {
        status: "applied",
        item: {
          ...currentItem!,
          ...event.payload,
          version: currentItem!.version + 1
        }
      };
    }

    case 'item_removed': {
      return {
        status: "applied",
        item: {
          ...currentItem!,
          deletedAt: new Date().toISOString(),
          version: currentItem!.version + 1
        }
      };
    }

    case 'item_restored': {
      const newItem = {
        ...currentItem!,
        version: currentItem!.version + 1
      };
      delete newItem.deletedAt;
      return {
        status: "applied",
        item: newItem
      };
    }

    default:
      return { status: "rejected", reason: "Unknown event type" };
  }
}
