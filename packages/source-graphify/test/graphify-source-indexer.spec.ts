import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EdgeType, NodeType } from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import { GraphifySourceIndexer } from '../src/graphify/graphify-source-indexer.js';

const fixture = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './fixtures/graphify-captured/graph.json',
);

const fakeIdentity = {
  sourceId: 'src_test',
  contentFingerprint: 'fp_test',
  dirty: false,
};

describe('GraphifySourceIndexer', () => {
  it('indexes from graph.json without invoking the graphify binary', async () => {
    const indexer = new GraphifySourceIndexer();
    const result = await indexer.indexFromGraphJson({
      graphJsonPath: fixture,
      identity: fakeIdentity,
    });

    expect(result.snapshot.identity).toEqual(fakeIdentity);
    expect(result.extraction.extractor).toBe('graphify');
    expect(result.extraction.extractorVersion).toBe('0.9.16');
    expect(result.snapshot.nodes.some((n) => n.name === 'PublicController')).toBe(
      true,
    );
    expect(
      result.snapshot.nodes.find((n) => n.name === 'PublicController')?.type,
    ).toBe(NodeType.CLASS);
    expect(result.snapshot.edges.some((e) => e.type === EdgeType.CALLS)).toBe(
      true,
    );
  });
});
