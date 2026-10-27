import { EdgeType, GraphSource, NodeType } from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import { IndexError } from '@corelive/core-engine';

import { KnowledgeSnapshotValidator } from '../src/graphify/validation/knowledge-snapshot-validator.js';

describe('KnowledgeSnapshotValidator', () => {
  it('allows an empty graph', () => {
    const validator = new KnowledgeSnapshotValidator();
    expect(() =>
      validator.validate({
        id: 'snap_test',
        createdAt: new Date(),
        identity: {
          sourceId: 'src_test',
          contentFingerprint: 'fp_test',
          dirty: false,
        },
        source: GraphSource.GRAPHIFY,
        nodes: [],
        edges: [],
      }),
    ).not.toThrow();
  });

  it('fails when an edge references a missing node', () => {
    const validator = new KnowledgeSnapshotValidator();

    expect(() =>
      validator.validate({
        id: 'snap_test',
        createdAt: new Date(),
        identity: {
          sourceId: 'src_test',
          contentFingerprint: 'fp_test',
          dirty: false,
        },
        source: GraphSource.GRAPHIFY,
        nodes: [
          {
            id: 'graphify:a',
            type: NodeType.FILE,
            name: 'a.ts',
            location: { filePath: 'a.ts' },
            evidence: [],
            metadata: { producer: 'graphify' },
          },
        ],
        edges: [
          {
            id: 'edge_1',
            type: EdgeType.CALLS,
            source: 'graphify:a',
            target: 'graphify:missing',
            metadata: { producer: 'graphify' },
            evidence: [],
          },
        ],
      }),
    ).toThrow(IndexError);
  });
});
