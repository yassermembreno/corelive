import type { KnowledgeSnapshot } from '@corelive/domain';

import type { SnapshotUniquenessKey } from '../persistence/snapshot-uniqueness.js';
import type { ExtractionDescriptor } from './source-indexer.js';

export interface GraphRepository {
  save(
    snapshot: KnowledgeSnapshot,
    extraction: ExtractionDescriptor,
  ): Promise<void>;
  findByUniquenessKey(
    key: SnapshotUniquenessKey,
  ): Promise<KnowledgeSnapshot | null>;
  getById(snapshotId: string): Promise<KnowledgeSnapshot | null>;
  /** Deterministic: ORDER BY created_at DESC, id DESC. */
  getLatest(): Promise<KnowledgeSnapshot | null>;
}
