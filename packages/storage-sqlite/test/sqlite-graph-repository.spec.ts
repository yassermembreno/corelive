import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { UniqueViolationError } from '@corelive/core-engine';
import { GraphSource, NodeType, EdgeType } from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import { SqliteGraphRepository } from '../src/sqlite-graph-repository.js';

function sampleSnapshot(id = 'snap_test_1') {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    identity: {
      sourceId: 'src_abc',
      dirty: false,
      contentFingerprint: 'fp_1',
      commitSha: 'deadbeef',
    },
    source: GraphSource.GRAPHIFY,
    nodes: [
      {
        id: 'graphify:a',
        type: NodeType.CLASS,
        name: 'A',
        metadata: {},
        location: { filePath: 'a.ts', startLine: 1 },
        evidence: [],
      },
    ],
    edges: [
      {
        id: 'edge_1',
        type: EdgeType.CALLS,
        source: 'graphify:a',
        target: 'graphify:a',
        metadata: {},
        evidence: [],
      },
    ],
  };
}

const extraction = {
  extractor: 'graphify' as const,
  extractorVersion: '0.9.16',
  canonicalSchemaVersion: '1',
  durationMs: 10,
};

describe('SqliteGraphRepository', () => {
  it('saves and loads a complete snapshot', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'corelive-sqlite-'));
    const dbPath = join(dir, 'corelive.sqlite');
    const repo = new SqliteGraphRepository(dbPath);

    try {
      const snapshot = sampleSnapshot();
      await repo.save(snapshot, extraction);

      const loaded = await repo.findByUniquenessKey({
        sourceId: 'src_abc',
        contentFingerprint: 'fp_1',
        extractor: 'graphify',
        extractorVersion: '0.9.16',
        canonicalSchemaVersion: '1',
      });

      expect(loaded?.id).toBe(snapshot.id);
      expect(loaded?.nodes).toHaveLength(1);
      expect(loaded?.edges).toHaveLength(1);
      expect(loaded?.identity.sourceId).toBe('src_abc');
    } finally {
      repo.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('throws UniqueViolationError on duplicate uniqueness key', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'corelive-sqlite-'));
    const dbPath = join(dir, 'corelive.sqlite');
    const repo = new SqliteGraphRepository(dbPath);

    try {
      await repo.save(sampleSnapshot('snap_a'), extraction);
      await expect(
        repo.save(sampleSnapshot('snap_b'), extraction),
      ).rejects.toBeInstanceOf(UniqueViolationError);
    } finally {
      repo.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
