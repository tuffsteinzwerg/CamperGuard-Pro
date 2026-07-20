import { InventoryEvent, SyncableInventoryItem, LocalSyncState } from '../types';

export interface InitializeRemoteStoreResult {
  remoteStoreId: string;
  initialCursor?: string;
}

export interface UploadEventsResult {
  acceptedEventIds: string[];
  rejectedEvents: Array<{
    eventId: string;
    reason: string;
    retryable: boolean;
  }>;
}

export interface RemoteInventoryEvent {
  event: InventoryEvent;
  remoteMetadata: {
    remoteEventId?: string;
    receivedAt?: string;
    providerSequence?: string;
  };
}

export interface DownloadChangesResult {
  events: RemoteInventoryEvent[];
  newCursor?: string;
  hasMore: boolean;
}

export interface SyncProvider {
  readonly providerId: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;

  initializeRemoteStore(input: {
    vehicleId: string;
  }): Promise<InitializeRemoteStoreResult>;

  uploadEvents(input: {
    vehicleId: string;
    events: InventoryEvent[];
  }): Promise<UploadEventsResult>;

  downloadChanges(input: {
    vehicleId: string;
    cursor?: string;
    limit?: number;
  }): Promise<DownloadChangesResult>;
}

export interface CloudAccessGrant {
  grantId: string;
  permissions: string[];
}

export interface GrantAccessInput {
  userId: string;
  permissions: string[];
}

export interface ChangeAccessInput {
  grantId: string;
  permissions: string[];
}

export interface RevokeAccessInput {
  grantId: string;
}

export interface CloudAclProvider {
  grantAccess(input: GrantAccessInput): Promise<CloudAccessGrant>;
  changeAccess(input: ChangeAccessInput): Promise<void>;
  revokeAccess(input: RevokeAccessInput): Promise<void>;
}

export interface InvitationRecord {
  invitationId: string;
  expiresAt: string;
}

export interface CreateInvitationInput {
  role: string;
}

export interface RequestMembershipInput {
  invitationId: string;
}

export interface MembershipRequest {
  requestId: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ApproveMembershipInput {
  requestId: string;
}

export interface RejectMembershipInput {
  requestId: string;
}

export interface InvitationCoordinator {
  createInvitation(
    input: CreateInvitationInput
  ): Promise<InvitationRecord>;

  requestMembership(
    input: RequestMembershipInput
  ): Promise<MembershipRequest>;

  approveMembership(
    input: ApproveMembershipInput
  ): Promise<void>;

  rejectMembership(
    input: RejectMembershipInput
  ): Promise<void>;
}

export interface DeferredEventRecord {
  event: InventoryEvent;
  remoteMetadata?: RemoteInventoryEvent["remoteMetadata"];

  reason: string;
  retryCount: number;

  firstDeferredAt: string;
  lastAttemptAt: string;
  status?: "pending" | "permanent_failure";
}

export interface DeferredEventRepository {
  get(eventId: string): Promise<DeferredEventRecord | undefined>;
  put(record: DeferredEventRecord): Promise<void>;
  delete(eventId: string): Promise<void>;
  listByItemId(itemId: string): Promise<DeferredEventRecord[]>;
  listAll(): Promise<DeferredEventRecord[]>;
  count(): Promise<number>;
}

export interface SyncConflictRecord {
  conflictId: string;
  event: InventoryEvent;
  currentItem?: SyncableInventoryItem;

  reason: string;
  status: "open" | "resolved" | "ignored";

  createdAt: string;
  resolvedAt?: string;
}

export interface SyncConflictRepository {
  get(conflictId: string): Promise<SyncConflictRecord | undefined>;
  put(record: SyncConflictRecord): Promise<void>;
  updateStatus(
    conflictId: string,
    status: SyncConflictRecord["status"],
    resolvedAt?: string
  ): Promise<void>;
  listOpen(): Promise<SyncConflictRecord[]>;
  listAll(): Promise<SyncConflictRecord[]>;
  countOpen(): Promise<number>;
}

export interface SyncStateRepository {
  get(providerId: string): Promise<LocalSyncState | undefined>;
  save(state: LocalSyncState): Promise<void>;
  update(
    providerId: string,
    updater: (
      current: LocalSyncState | undefined
    ) => LocalSyncState
  ): Promise<LocalSyncState>;
  delete(providerId: string): Promise<void>;
}

export type SyncErrorCode =
  | "OFFLINE"
  | "NOT_CONNECTED"
  | "AUTH_REQUIRED"
  | "ACCESS_REVOKED"
  | "REMOTE_TEMPORARY_ERROR"
  | "REMOTE_PERMANENT_ERROR"
  | "LOCAL_STORAGE_ERROR"
  | "INVALID_EVENT"
  | "UNSUPPORTED_SCHEMA"
  | "INITIALIZATION_REQUIRED";

