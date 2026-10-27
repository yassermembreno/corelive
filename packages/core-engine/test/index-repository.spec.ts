import { describe, expect, it } from 'vitest';

import { GraphSource } from '@corelive/domain';

import { UniqueViolationError } from '../src/errors/unique-violation-error.js';
import { IndexRepository } from '../src/index-repository.js';
import type { GraphRepository } from '../src/ports/graph-repository.js';
import type {
  SourceIndexResult,
  SourceIndexer,
} from '../src/ports/source-indexer.js';

function makeSnapshot(id: string) {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    identity: {
      sourceId: 'src_abc123',
      contentFingerprint: 'fp_deadbeef',
      dirty: false,
    },
    nodes: [],
    edges: [],
    source: GraphSource.GRAPHIFY,
  };
}

describe('IndexRepository', () => {
  it('returns UNCHANGED when persistence hits a UNIQUE violation', async () => {
    const existing = makeSnapshot('snap_existing');
    const incoming = makeSnapshot('snap_incoming');

    const result: SourceIndexResult = {
      snapshot: incoming,
      identity: incoming.identity,
      warnings: [],
      extraction: {
        extractor: 'graphify',
        extractorVersion: '0.9.16',
        canonicalSchemaVersion: '1',
        durationMs: 12,
      },
    };

    const sourceIndexer: SourceIndexer = {
      index: async () => result,
    };

    let saveCalls = 0;
    const graphRepository: GraphRepository = {
      save: async () => {
        saveCalls += 1;
        throw new UniqueViolationError();
      },
      findByUniquenessKey: async () => existing,
    };

    const repository = new IndexRepository(sourceIndexer, graphRepository);
    const outcome = await repository.index({ sourcePath: '/tmp/example' });

    expect(saveCalls).toBe(1);
    expect(outcome).toEqual({
      status: 'UNCHANGED',
      snapshotId: 'snap_existing',
    });
  });

  it('returns INDEXED when persistence succeeds', async () => {
    const snapshot = makeSnapshot('snap_new');

    const sourceIndexer: SourceIndexer = {
      index: async () => ({
        snapshot,
        identity: snapshot.identity,
        warnings: [{ code: 'TEST', message: 'warn' }],
        extraction: {
          extractor: 'graphify',
          extractorVersion: '0.9.16',
          canonicalSchemaVersion: '1',
          durationMs: 5,
        },
      }),
    };

    const graphRepository: GraphRepository = {
      save: async () => undefined,
      findByUniquenessKey: async () => null,
    };

    const repository = new IndexRepository(sourceIndexer, graphRepository);
    const outcome = await repository.index({ sourcePath: '/tmp/example' });

    expect(outcome).toEqual({
      status: 'INDEXED',
      snapshotId: 'snap_new',
      warnings: [{ code: 'TEST', message: 'warn' }],
    });
  });
});
