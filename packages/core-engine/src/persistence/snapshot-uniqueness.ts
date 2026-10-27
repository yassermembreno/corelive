/**
 * Snapshot uniqueness — enforced by SQLite UNIQUE, not by a prior SELECT.
 *
 * On UNIQUE violation under concurrency:
 * IndexRepository loads the existing snapshot and returns UNCHANGED.
 */
export const SNAPSHOT_UNIQUENESS_COLUMNS = [
  'source_id',
  'content_fingerprint',
  'extractor',
  'extractor_version',
  'canonical_schema_version',
] as const;

export type SnapshotUniquenessKey = {
  sourceId: string;
  contentFingerprint: string;
  extractor: string;
  extractorVersion: string;
  canonicalSchemaVersion: string;
};

export const SNAPSHOT_UNIQUENESS_SQL = `
UNIQUE (
  source_id,
  content_fingerprint,
  extractor,
  extractor_version,
  canonical_schema_version
)
`.trim();

export function snapshotUniquenessKey(
  key: SnapshotUniquenessKey,
): SnapshotUniquenessKey {
  return key;
}
