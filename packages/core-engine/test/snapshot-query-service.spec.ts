import {
  EdgeType,
  GraphSource,
  NodeType,
  type KnowledgeSnapshot,
} from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import type { GraphRepository } from '../src/ports/graph-repository.js';
import { SnapshotQueryService } from '../src/query/snapshot-query-service.js';

function fixtureSnapshot(): KnowledgeSnapshot {
  return {
    id: 'snap_q1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    identity: {
      sourceId: 'src_q',
      dirty: false,
      contentFingerprint: 'fp_q',
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
      {
        id: 'n_dup_a',
        name: 'Dup',
        type: NodeType.CLASS,
        metadata: {},
        location: { filePath: 'a.ts', startLine: 1 },
        evidence: [],
      },
      {
        id: 'n_dup_b',
        name: 'Dup',
        type: NodeType.CLASS,
        metadata: {},
        location: { filePath: 'b.ts', startLine: 1 },
        evidence: [],
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

function repoWith(snapshot: KnowledgeSnapshot | null): GraphRepository {
  return {
    save: async () => undefined,
    findByUniquenessKey: async () => null,
    getById: async (id) => (snapshot && snapshot.id === id ? snapshot : null),
    getLatest: async () => snapshot,
  };
}

describe('SnapshotQueryService', () => {
  it('who-calls resolves Graphify names against latest snapshot', async () => {
    const service = new SnapshotQueryService(repoWith(fixtureSnapshot()));
    const result = await service.whoCalls('.reserve()');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hits).toHaveLength(1);
      expect(result.value.hits[0]?.node.name).toBe('.create()');
    }
  });

  it('returns SNAPSHOT_NOT_FOUND when empty', async () => {
    const service = new SnapshotQueryService(repoWith(null));
    const result = await service.whoCalls('.reserve()');
    expect(result).toEqual({
      ok: false,
      error: { code: 'SNAPSHOT_NOT_FOUND', snapshotId: undefined },
    });
  });

  it('returns SYMBOL_AMBIGUOUS with candidates', async () => {
    const service = new SnapshotQueryService(repoWith(fixtureSnapshot()));
    const result = await service.evidence('Dup');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SYMBOL_AMBIGUOUS');
    }
  });

  it('path NO_PATH is a successful query result', async () => {
    const snap = fixtureSnapshot();
    snap.edges = [];
    const service = new SnapshotQueryService(repoWith(snap));
    const result = await service.path('.create()', '.reserve()');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toEqual({
        status: 'no_path',
        reason: 'NO_PATH',
      });
    }
  });
});
