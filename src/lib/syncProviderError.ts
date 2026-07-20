import { SyncErrorCode } from './syncTypes';

export class SyncProviderError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'SyncProviderError';
  }
}
