export { IndexError } from './errors/index-error.js';
export {
  UniqueViolationError,
  isUniqueViolation,
} from './errors/unique-violation-error.js';
export { createEvidenceId, createSnapshotId } from './ids/create-id.js';
export { createDeterministicEdgeId } from './ids/create-edge-id.js';
export { IndexRepository } from './index-repository.js';
export {
  SNAPSHOT_UNIQUENESS_COLUMNS,
  SNAPSHOT_UNIQUENESS_SQL,
  snapshotUniquenessKey,
  type SnapshotUniquenessKey,
} from './persistence/snapshot-uniqueness.js';
export type { IndexFailure } from './ports/index-failure.js';
export type {
  IndexOutcome,
  IndexStage,
  IndexWarning,
} from './ports/index-outcome.js';
export type { GraphRepository } from './ports/graph-repository.js';
export type {
  ExtractionDescriptor,
  IndexSourceRequest,
  SourceIndexResult,
  SourceIndexer,
} from './ports/source-indexer.js';
export { err, ok, type Result } from './result.js';
export { computeContentFingerprint } from './source-identity/content-fingerprint.js';
export {
  computeSourceIdentity,
  type ComputeSourceIdentityOptions,
} from './source-identity/compute-source-identity.js';
export { normalizeRepositoryUri } from './source-identity/normalize-repository-uri.js';
export { resolveDefaultCatalogPath } from './source-identity/source-catalog.js';
