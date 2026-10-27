import type { IndexFailure } from './index-failure.js';

export type IndexWarning = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type IndexStage =
  | 'identity'
  | 'extract'
  | 'validate_external'
  | 'map'
  | 'validate_canonical'
  | 'persist';

export type IndexOutcome =
  | { status: 'INDEXED'; snapshotId: string; warnings: IndexWarning[] }
  | { status: 'UNCHANGED'; snapshotId: string }
  | {
      status: 'FAILED';
      stage: IndexStage;
      failure: IndexFailure;
      message?: string;
    };
