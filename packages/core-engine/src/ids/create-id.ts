import { randomUUID } from 'node:crypto';

import type { EvidenceId, SnapshotId } from '@corelive/domain';

export function createSnapshotId(): SnapshotId {
  return `snap_${randomUUID()}`;
}

export function createEvidenceId(): EvidenceId {
  return `ev_${randomUUID()}`;
}
