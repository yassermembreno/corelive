import {
  EdgeType,
  GraphSource,
  NodeType,
  type GraphEdge,
  type GraphNode,
  type KnowledgeSnapshot,
} from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import { DependencyTool } from '../src/tools/dependency-tool.js';

function node(id: string, name: string): GraphNode {
  return {
    id,
    name,
    type: NodeType.FUNCTION,
    metadata: {},
    location: { filePath: `${name}.ts` },
    evidence: [
      {
        id: `ev_${id}`,
        source: 'graphify',
        origin: 'ast',
        filePath: `${name}.ts`,
      },
    ],
  };
}

function edge(
  id: string,
  type: EdgeType,
  source: string,
  target: string,
): GraphEdge {
  return {
    id,
    type,
    source,
    target,
    metadata: {},
    evidence: [
      {
        id: `ev_${id}`,
        source: 'graphify',
        origin: 'ast',
      },
    ],
  };
}

function snap(nodes: GraphNode[], edges: GraphEdge[]): KnowledgeSnapshot {
  return {
    id: 'snap',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    identity: {
      sourceId: 'src',
      dirty: false,
      contentFingerprint: 'fp',
    },
    source: GraphSource.GRAPHIFY,
    nodes,
    edges,
  };
}

describe('DependencyTool', () => {
  const tool = new DependencyTool();
  const a = node('a', 'A');
  const b = node('b', 'B');
  const c = node('c', 'C');
  const snapshot = snap(
    [a, b, c],
    [
      edge('e_ab', EdgeType.CALLS, a.id, b.id),
      edge('e_bc', EdgeType.CALLS, b.id, c.id),
      edge('e_ac', EdgeType.CONTAINS, a.id, c.id),
      edge('e_imp', EdgeType.IMPORTS, a.id, c.id),
    ],
  );

  it('excludes CONTAINS from the default walk and keeps types separate', () => {
    const result = tool.query(snapshot, a.id, {
      direction: 'outgoing',
      maxDepth: 2,
    });
    expect(result?.byType.has(EdgeType.CONTAINS)).toBe(false);
    expect(result?.byType.get(EdgeType.CALLS)?.map((r) => r.nodeId)).toEqual([
      'b',
      'c',
    ]);
    expect(result?.byType.get(EdgeType.IMPORTS)?.map((r) => r.nodeId)).toEqual([
      'c',
    ]);
  });

  it('keeps CALLS and IMPORTS in separate buckets', () => {
    const result = tool.query(snapshot, c.id, {
      direction: 'incoming',
      maxDepth: 2,
      edgeTypes: [EdgeType.CALLS, EdgeType.IMPORTS],
    });
    expect(result?.byType.get(EdgeType.CALLS)?.some((r) => r.nodeId === 'b')).toBe(
      true,
    );
    expect(
      result?.byType.get(EdgeType.IMPORTS)?.some((r) => r.nodeId === 'a'),
    ).toBe(true);
  });

  it('allows CONTAINS only when explicitly opted in', () => {
    const denied = tool.query(snapshot, a.id, {
      direction: 'outgoing',
      maxDepth: 1,
      edgeTypes: [EdgeType.CONTAINS],
    });
    expect(denied?.edgeTypesApplied).toEqual([]);

    const allowed = tool.query(snapshot, a.id, {
      direction: 'outgoing',
      maxDepth: 1,
      edgeTypes: [EdgeType.CONTAINS],
      includeContains: true,
    });
    expect(allowed?.byType.get(EdgeType.CONTAINS)?.[0]?.nodeId).toBe('c');
  });
});
