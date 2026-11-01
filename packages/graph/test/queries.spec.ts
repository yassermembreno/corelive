import {
  EdgeType,
  GraphSource,
  NodeType,
  type GraphEdge,
  type GraphNode,
  type KnowledgeSnapshot,
} from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import {
  queryDependencies,
  queryDependents,
  queryEvidence,
  queryPath,
  queryWhoCalls,
} from '../src/queries.js';
import { resolveSymbol } from '../src/resolve-symbol.js';

function node(
  id: string,
  name: string,
  extras?: Partial<GraphNode>,
): GraphNode {
  return {
    id,
    name,
    type: NodeType.METHOD,
    metadata: {},
    location: { filePath: `${name}.ts`, startLine: 1 },
    evidence: [
      {
        id: `ev_${id}`,
        source: 'graphify',
        origin: 'ast',
        filePath: `${name}.ts`,
        location: 'L1',
      },
    ],
    ...extras,
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
        filePath: 'src/controller.ts',
        location: 'L7',
      },
    ],
  };
}

function snapshot(nodes: GraphNode[], edges: GraphEdge[]): KnowledgeSnapshot {
  return {
    id: 'snap_test',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    identity: {
      sourceId: 'src_test',
      dirty: false,
      contentFingerprint: 'fp_test',
    },
    source: GraphSource.GRAPHIFY,
    nodes,
    edges,
  };
}

/** Mini-repo mental model: PublicController.create → .reserve() */
const create = node('n_create', '.create()');
const reserve = node('n_reserve', '.reserve()');
const controller = node('n_controller', 'PublicController', {
  type: NodeType.CLASS,
});
const service = node('n_service', 'PublicReservationService', {
  type: NodeType.CLASS,
});

const mini = snapshot(
  [controller, create, service, reserve],
  [
    edge('e_contains_c', EdgeType.CONTAINS, controller.id, create.id),
    edge('e_contains_s', EdgeType.CONTAINS, service.id, reserve.id),
    edge('e_calls', EdgeType.CALLS, create.id, reserve.id),
  ],
);

describe('resolveSymbol', () => {
  it('prefers exact id over name', () => {
    const result = resolveSymbol(mini, 'n_reserve');
    expect(result).toEqual({ status: 'found', node: reserve });
  });

  it('resolves unique Graphify-style names', () => {
    const result = resolveSymbol(mini, '.reserve()');
    expect(result).toEqual({ status: 'found', node: reserve });
  });

  it('returns ambiguous candidates sorted by id', () => {
    const dup = snapshot(
      [
        node('n_b', 'Shared'),
        node('n_a', 'Shared'),
        node('n_c', 'Other'),
      ],
      [],
    );
    const result = resolveSymbol(dup, 'Shared');
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates.map((c) => c.id)).toEqual(['n_a', 'n_b']);
    }
  });

  it('returns not_found for unknown symbols', () => {
    expect(resolveSymbol(mini, 'Missing').status).toBe('not_found');
  });
});

describe('queryWhoCalls', () => {
  it('returns callers via incoming CALLS only', () => {
    const hits = queryWhoCalls(mini, reserve.id);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.node.name).toBe('.create()');
    expect(hits[0]?.edge.type).toBe(EdgeType.CALLS);
  });

  it('does not expand class-wide callers', () => {
    expect(queryWhoCalls(mini, service.id)).toEqual([]);
  });
});

describe('queryDependents / queryDependencies', () => {
  it('lists dependents (incoming) and can filter by type', () => {
    const all = queryDependents(mini, reserve.id);
    expect(all.map((h) => h.edge.type).sort()).toEqual([
      EdgeType.CALLS,
      EdgeType.CONTAINS,
    ]);

    const callsOnly = queryDependents(mini, reserve.id, {
      edgeTypes: [EdgeType.CALLS],
    });
    expect(callsOnly).toHaveLength(1);
    expect(callsOnly[0]?.node.name).toBe('.create()');
  });

  it('lists dependencies (outgoing)', () => {
    const deps = queryDependencies(mini, create.id);
    expect(deps.map((h) => h.node.name)).toEqual(['.reserve()']);
  });

  it('returns empty for isolated nodes', () => {
    const alone = snapshot([node('n_alone', 'Alone')], []);
    expect(queryDependents(alone, 'n_alone')).toEqual([]);
    expect(queryDependencies(alone, 'n_alone')).toEqual([]);
  });
});

describe('queryPath', () => {
  it('finds the shortest directed path', () => {
    const result = queryPath(mini, create.id, reserve.id);
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.nodes.map((n) => n.name)).toEqual([
        '.create()',
        '.reserve()',
      ]);
      expect(result.edges).toHaveLength(1);
    }
  });

  it('is deterministic on multi-path graphs via lexical neighbor order', () => {
    const a = node('n_a', 'A');
    const b = node('n_b', 'B');
    const c = node('n_c', 'C');
    const d = node('n_d', 'D');
    const multi = snapshot(
      [a, b, c, d],
      [
        edge('e_ac', EdgeType.CALLS, a.id, c.id),
        edge('e_ab', EdgeType.CALLS, a.id, b.id),
        edge('e_bd', EdgeType.CALLS, b.id, d.id),
        edge('e_cd', EdgeType.CALLS, c.id, d.id),
      ],
    );

    const result = queryPath(multi, a.id, d.id);
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      // BFS with lexical expand: b before c → path A→B→D
      expect(result.nodes.map((n) => n.id)).toEqual(['n_a', 'n_b', 'n_d']);
    }
  });

  it('handles cycles without looping forever', () => {
    const a = node('n_a', 'A');
    const b = node('n_b', 'B');
    const cyclic = snapshot(
      [a, b],
      [
        edge('e_ab', EdgeType.CALLS, a.id, b.id),
        edge('e_ba', EdgeType.CALLS, b.id, a.id),
      ],
    );
    const result = queryPath(cyclic, a.id, b.id);
    expect(result.status).toBe('found');
  });

  it('returns NO_PATH when unreachable', () => {
    const a = node('n_a', 'A');
    const b = node('n_b', 'B');
    const disconnected = snapshot([a, b], []);
    expect(queryPath(disconnected, a.id, b.id)).toEqual({
      status: 'no_path',
      reason: 'NO_PATH',
    });
  });

  it('returns MAX_DEPTH_REACHED when depth limit blocks the path', () => {
    const n0 = node('n0', 'N0');
    const n1 = node('n1', 'N1');
    const n2 = node('n2', 'N2');
    const chain = snapshot(
      [n0, n1, n2],
      [
        edge('e01', EdgeType.CALLS, n0.id, n1.id),
        edge('e12', EdgeType.CALLS, n1.id, n2.id),
      ],
    );
    expect(queryPath(chain, n0.id, n2.id, { maxDepth: 1 })).toEqual({
      status: 'no_path',
      reason: 'MAX_DEPTH_REACHED',
    });
  });
});

describe('queryEvidence', () => {
  it('exposes original node and incident edge evidence', () => {
    const result = queryEvidence(mini, reserve.id);
    expect(result?.node.name).toBe('.reserve()');
    expect(result?.nodeEvidence[0]?.id).toBe('ev_n_reserve');
    expect(result?.incidentEdges.length).toBeGreaterThan(0);
    expect(result?.incidentEdges[0]?.evidence[0]?.origin).toBe('ast');
  });
});
