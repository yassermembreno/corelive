import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SnapshotQueryService } from '@corelive/core-engine';
import {
  EdgeType,
  GraphSource,
  NodeType,
  type KnowledgeSnapshot,
} from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import { SqliteGraphRepository } from '../src/sqlite-graph-repository.js';

function seedSnapshot(): KnowledgeSnapshot {
  return {
    id: 'snap_integ',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    identity: {
      sourceId: 'src_integ',
      dirty: false,
      contentFingerprint: 'fp_integ',
    },
    source: GraphSource.GRAPHIFY,
    nodes: [
      {
        id: 'n_create',
        name: '.create()',
        type: NodeType.METHOD,
        metadata: {},
        location: { filePath: 'controller.ts', startLine: 6 },
        evidence: [
          {
            id: 'ev_create',
            source: 'graphify',
            origin: 'ast',
            filePath: 'controller.ts',
            location: 'L6',
          },
        ],
      },
      {
        id: 'n_reserve',
        name: '.reserve()',
        type: NodeType.METHOD,
        metadata: {},
        location: { filePath: 'service.ts', startLine: 2 },
        evidence: [
          {
            id: 'ev_reserve',
            source: 'graphify',
            origin: 'ast',
            filePath: 'service.ts',
            location: 'L2',
          },
        ],
      },
    ],
    edges: [
      {
        id: 'e_calls',
        type: EdgeType.CALLS,
        source: 'n_create',
        target: 'n_reserve',
        metadata: {},
        evidence: [
          {
            id: 'ev_edge',
            source: 'graphify',
            origin: 'ast',
            filePath: 'controller.ts',
            location: 'L7',
          },
        ],
      },
    ],
  };
}

const extraction = {
  extractor: 'graphify' as const,
  extractorVersion: '0.9.16',
  canonicalSchemaVersion: '1',
  durationMs: 1,
};

describe('query integration (SQLite)', () => {
  it('indexes via save then answers who-calls / path / evidence', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'corelive-qint-'));
    const repo = new SqliteGraphRepository(join(dir, 'corelive.sqlite'));
    const service = new SnapshotQueryService(repo);

    try {
      await repo.save(seedSnapshot(), extraction);

      const byId = await repo.getById('snap_integ');
      expect(byId?.nodes).toHaveLength(2);

      const who = await service.whoCalls('.reserve()');
      expect(who.ok).toBe(true);
      if (who.ok) {
        expect(who.value.hits[0]?.node.name).toBe('.create()');
      }

      const path = await service.path('.create()', '.reserve()');
      expect(path.ok).toBe(true);
      if (path.ok) {
        expect(path.value.path.status).toBe('found');
      }

      const evidence = await service.evidence('.reserve()', {
        snapshotId: 'snap_integ',
      });
      expect(evidence.ok).toBe(true);
      if (evidence.ok) {
        expect(evidence.value.evidence.nodeEvidence[0]?.id).toBe('ev_reserve');
      }
    } finally {
      repo.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
