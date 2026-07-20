const fs = require('fs');
let code = fs.readFileSync('src/lib/syncCoordinator.ts', 'utf8');

const typesToAdd = `
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
`;

code = code.replace(/export interface DownloadRunResult/, typesToAdd + '\nexport interface DownloadRunResult');
fs.writeFileSync('src/lib/syncCoordinator.ts', code);
