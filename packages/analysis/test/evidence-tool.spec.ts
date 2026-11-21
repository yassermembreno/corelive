import { EdgeType, NodeType, type GraphEdge, type GraphNode } from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import { classifyEvidence, EvidenceTool } from '../src/tools/evidence-tool.js';

function node(partial?: Partial<GraphNode>): GraphNode {
  return {
    id: 'n1',
    name: 'Reserve',
    type: NodeType.METHOD,
    metadata: {},
    location: { filePath: 'src/service.ts', startLine: 2 },
    evidence: [],
    ...partial,
  };
}

describe('EvidenceTool', () => {
  const tool = new EvidenceTool();

  it('marks evidence valid when provenance and path agree', () => {
    const result = classifyEvidence(
      {
        id: 'e1',
        source: 'graphify',
        origin: 'ast',
        filePath: 'src/service.ts',
        location: 'L2',
      },
      { filePath: 'src/service.ts' },
    );
    expect(result.availability).toBe('valid');
  });

  it('does not treat filePath alone as valid without provenance', () => {
    const result = classifyEvidence(
      {
        id: 'e2',
        source: '',
        origin: '',
        filePath: 'src/service.ts',
      },
      { filePath: 'src/service.ts' },
    );
    expect(result.availability).toBe('incomplete');
  });

  it('flags inconsistent filePath against the subject', () => {
    const result = classifyEvidence(
      {
        id: 'e3',
        source: 'graphify',
        origin: 'ast',
        filePath: 'other.ts',
      },
      { filePath: 'src/service.ts' },
    );
    expect(result.availability).toBe('incomplete');
    expect(result.reason).toMatch(/does not match/);
  });

  it('returns missing when the node has no evidence', () => {
    const records = tool.forNode(node());
    expect(records[0]?.availability).toBe('missing');
  });

  it('classifies edge evidence', () => {
    const edge: GraphEdge = {
      id: 'edge1',
      type: EdgeType.CALLS,
      source: 'a',
      target: 'b',
      metadata: {},
      evidence: [
        {
          id: 'ev',
          source: 'graphify',
          origin: 'EXTRACTED',
          filePath: 'src/service.ts',
          location: 'L7',
        },
      ],
    };
    expect(tool.forEdge(edge, node())[0]?.availability).toBe('valid');
  });
});
