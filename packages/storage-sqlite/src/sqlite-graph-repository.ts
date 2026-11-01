import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  SNAPSHOT_UNIQUENESS_SQL,
  UniqueViolationError,
  type ExtractionDescriptor,
  type GraphRepository,
  type SnapshotUniquenessKey,
} from '@corelive/core-engine';
import type {
  GraphEdge,
  GraphNode,
  GraphSource,
  KnowledgeSnapshot,
  SourceIdentity,
} from '@corelive/domain';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  repository_uri TEXT,
  commit_sha TEXT,
  dirty INTEGER NOT NULL,
  content_fingerprint TEXT NOT NULL,
  extractor TEXT NOT NULL,
  extractor_version TEXT NOT NULL,
  canonical_schema_version TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  ${SNAPSHOT_UNIQUENESS_SQL}
);

CREATE TABLE IF NOT EXISTS nodes (
  snapshot_id TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  location_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, id),
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS edges (
  snapshot_id TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, id),
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
);
`;

type SnapshotRow = {
  id: string;
  created_at: string;
  source: string;
  source_id: string;
  repository_uri: string | null;
  commit_sha: string | null;
  dirty: number;
  content_fingerprint: string;
  extractor: string;
  extractor_version: string;
  canonical_schema_version: string;
  duration_ms: number;
};

type NodeRow = {
  id: string;
  type: string;
  name: string;
  metadata_json: string;
  location_json: string;
  evidence_json: string;
};

type EdgeRow = {
  id: string;
  type: string;
  source_node_id: string;
  target_node_id: string;
  metadata_json: string;
  evidence_json: string;
};

export class SqliteGraphRepository implements GraphRepository {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  async save(
    snapshot: KnowledgeSnapshot,
    extraction: ExtractionDescriptor,
  ): Promise<void> {
    const insertSnapshot = this.db.prepare(`
      INSERT INTO snapshots (
        id, created_at, source, source_id, repository_uri, commit_sha, dirty,
        content_fingerprint, extractor, extractor_version, canonical_schema_version, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertNode = this.db.prepare(`
      INSERT INTO nodes (
        snapshot_id, id, type, name, metadata_json, location_json, evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEdge = this.db.prepare(`
      INSERT INTO edges (
        snapshot_id, id, type, source_node_id, target_node_id, metadata_json, evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      this.db.exec('BEGIN');

      insertSnapshot.run(
        snapshot.id,
        snapshot.createdAt.toISOString(),
        snapshot.source,
        snapshot.identity.sourceId,
        snapshot.identity.repositoryUri ?? null,
        snapshot.identity.commitSha ?? null,
        snapshot.identity.dirty ? 1 : 0,
        snapshot.identity.contentFingerprint,
        extraction.extractor,
        extraction.extractorVersion,
        extraction.canonicalSchemaVersion,
        extraction.durationMs,
      );

      for (const node of snapshot.nodes) {
        insertNode.run(
          snapshot.id,
          node.id,
          node.type,
          node.name,
          JSON.stringify(node.metadata ?? {}),
          JSON.stringify(node.location),
          JSON.stringify(node.evidence ?? []),
        );
      }

      for (const edge of snapshot.edges) {
        insertEdge.run(
          snapshot.id,
          edge.id,
          edge.type,
          edge.source,
          edge.target,
          JSON.stringify(edge.metadata ?? {}),
          JSON.stringify(edge.evidence ?? []),
        );
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      if (isSqliteUniqueViolation(error)) {
        throw new UniqueViolationError('Snapshot uniqueness constraint failed', {
          cause: error,
        });
      }
      throw error;
    }
  }

  async findByUniquenessKey(
    key: SnapshotUniquenessKey,
  ): Promise<KnowledgeSnapshot | null> {
    const row = this.db
      .prepare(
        `
      SELECT * FROM snapshots
      WHERE source_id = ?
        AND content_fingerprint = ?
        AND extractor = ?
        AND extractor_version = ?
        AND canonical_schema_version = ?
      LIMIT 1
    `,
      )
      .get(
        key.sourceId,
        key.contentFingerprint,
        key.extractor,
        key.extractorVersion,
        key.canonicalSchemaVersion,
      ) as SnapshotRow | undefined;

    if (!row) {
      return null;
    }

    return this.loadSnapshot(row);
  }

  async getById(snapshotId: string): Promise<KnowledgeSnapshot | null> {
    const row = this.db
      .prepare(`SELECT * FROM snapshots WHERE id = ? LIMIT 1`)
      .get(snapshotId) as SnapshotRow | undefined;

    if (!row) {
      return null;
    }

    return this.loadSnapshot(row);
  }

  async getLatest(): Promise<KnowledgeSnapshot | null> {
    const row = this.db
      .prepare(
        `
      SELECT * FROM snapshots
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
      )
      .get() as SnapshotRow | undefined;

    if (!row) {
      return null;
    }

    return this.loadSnapshot(row);
  }

  private loadSnapshot(row: SnapshotRow): KnowledgeSnapshot {
    const nodes = (
      this.db
        .prepare(
          `SELECT id, type, name, metadata_json, location_json, evidence_json
           FROM nodes WHERE snapshot_id = ?`,
        )
        .all(row.id) as NodeRow[]
    ).map(
      (n): GraphNode => ({
        id: n.id,
        type: n.type as GraphNode['type'],
        name: n.name,
        metadata: JSON.parse(n.metadata_json) as unknown,
        location: JSON.parse(n.location_json) as GraphNode['location'],
        evidence: JSON.parse(n.evidence_json) as GraphNode['evidence'],
      }),
    );

    const edges = (
      this.db
        .prepare(
          `SELECT id, type, source_node_id, target_node_id, metadata_json, evidence_json
           FROM edges WHERE snapshot_id = ?`,
        )
        .all(row.id) as EdgeRow[]
    ).map(
      (e): GraphEdge => ({
        id: e.id,
        type: e.type as GraphEdge['type'],
        source: e.source_node_id,
        target: e.target_node_id,
        metadata: JSON.parse(e.metadata_json) as unknown,
        evidence: JSON.parse(e.evidence_json) as GraphEdge['evidence'],
      }),
    );

    const identity: SourceIdentity = {
      sourceId: row.source_id,
      repositoryUri: row.repository_uri ?? undefined,
      commitSha: row.commit_sha ?? undefined,
      dirty: row.dirty === 1,
      contentFingerprint: row.content_fingerprint,
    };

    return {
      id: row.id,
      createdAt: new Date(row.created_at),
      identity,
      nodes,
      edges,
      source: row.source as GraphSource,
    };
  }
}

function isSqliteUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === 'ERR_SQLITE_ERROR' &&
    /UNIQUE constraint failed/i.test(error.message)
  ) || /UNIQUE constraint failed/i.test(error.message);
}
