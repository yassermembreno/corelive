import {
  EdgeType,
  GraphSource,
  NodeType,
  type GraphNode,
  type KnowledgeSnapshot,
} from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import {
  resolveSymbolFriendly,
  symbolExpansions,
} from '../src/resolve-symbol-friendly.js';

function node(id: string, name: string): GraphNode {
  return {
    id,
    name,
    type: NodeType.METHOD,
    metadata: {},
    location: { filePath: `${name}.ts`, startLine: 1 },
    evidence: [],
  };
}

function snapshot(nodes: GraphNode[]): KnowledgeSnapshot {
  return {
    id: 'snap_friendly',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    identity: {
      sourceId: 'src',
      dirty: false,
      contentFingerprint: 'fp',
    },
    source: GraphSource.GRAPHIFY,
    nodes,
    edges: [
      {
        id: 'e1',
        type: EdgeType.CALLS,
        source: 'n_create',
        target: 'n_reserve',
        metadata: {},
        evidence: [],
      },
    ],
  };
}

describe('symbolExpansions', () => {
  it('returns deterministic unique expansions', () => {
    expect(symbolExpansions('reserve')).toEqual([
      'reserve',
      '.reserve',
      'reserve()',
      '.reserve()',
    ]);
  });
});

describe('resolveSymbolFriendly', () => {
  const snap = snapshot([
    node('n_create', '.create()'),
    node('n_reserve', '.reserve()'),
    node('n_controller', 'PublicController'),
  ]);

  it('resolves Graphify method shorthand reserve → .reserve()', () => {
    const result = resolveSymbolFriendly(snap, 'reserve');
    expect(result).toEqual({
      status: 'found',
      node: snap.nodes.find((n) => n.id === 'n_reserve'),
    });
  });

  it('resolves create → .create()', () => {
    const result = resolveSymbolFriendly(snap, 'create');
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.node.name).toBe('.create()');
    }
  });

  it('prefers exact id over expansions', () => {
    const result = resolveSymbolFriendly(snap, 'n_reserve');
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.node.id).toBe('n_reserve');
    }
  });

  it('returns ambiguous when expansions match multiple nodes', () => {
    const ambiguous = snapshot([
      node('n_foo', 'Foo'),
      node('n_dot_foo', '.Foo()'),
    ]);
    // Input "Foo" matches exact name Foo; not ambiguous via friendly layer.
    expect(resolveSymbolFriendly(ambiguous, 'Foo').status).toBe('found');

    // Bare "Foo" when only .Foo() and Foo() exist without exact Foo:
    const methods = snapshot([
      node('n_a', 'Foo()'),
      node('n_b', '.Foo()'),
    ]);
    const result = resolveSymbolFriendly(methods, 'Foo');
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates.map((c) => c.id).sort()).toEqual(['n_a', 'n_b']);
    }
  });

  it('returns not_found for unknown symbols', () => {
    expect(resolveSymbolFriendly(snap, 'missing').status).toBe('not_found');
  });
});
