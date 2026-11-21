import type { GraphRepository } from '@corelive/core-engine';
import {
  EdgeType,
  GraphSource,
  NodeType,
  type GraphEdge,
  type GraphNode,
  type KnowledgeSnapshot,
} from '@corelive/domain';

export function makeNode(
  id: string,
  name: string,
  filePath: string,
  extras?: Partial<GraphNode>,
): GraphNode {
  return {
    id,
    name,
    type: NodeType.FUNCTION,
    metadata: {},
    location: { filePath, startLine: 1 },
    evidence: [
      {
        id: `ev_${id}`,
        source: 'graphify',
        origin: 'ast',
        filePath,
        location: 'L1',
      },
    ],
    ...extras,
  };
}

export function makeEdge(
  id: string,
  type: EdgeType,
  source: string,
  target: string,
  filePath = 'src/a.ts',
): GraphEdge {
  return {
    id,
    type,
    source,
    target,
    metadata: { producer: 'graphify', sourceRelation: type.toLowerCase() },
    evidence: [
      {
        id: `ev_${id}`,
        source: 'graphify',
        origin: 'EXTRACTED',
        filePath,
        location: 'L2',
      },
    ],
  };
}

export function makeSnapshot(
  nodes: GraphNode[],
  edges: GraphEdge[],
  id = 'snap_explain',
): KnowledgeSnapshot {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    identity: {
      sourceId: 'src_explain',
      dirty: false,
      contentFingerprint: 'fp_explain',
    },
    source: GraphSource.GRAPHIFY,
    nodes,
    edges,
  };
}

/** A → B → C via CALLS, plus an IMPORTS edge A→C and CONTAINS noise. */
export function explainFixtureSnapshot(): KnowledgeSnapshot {
  const a = makeNode('n_a', 'alpha', 'src/alpha.ts');
  const b = makeNode('n_b', 'beta', 'src/beta.ts');
  const c = makeNode('n_c', 'gamma', 'src/gamma.ts');
  const formatOne = makeNode('n_format_1', 'format', 'src/one.ts');
  const formatTwo = makeNode('n_format_2', 'format', 'src/two.ts');
  const alone = makeNode('n_alone', 'lonely', 'src/lonely.ts');

  return makeSnapshot(
    [a, b, c, formatOne, formatTwo, alone],
    [
      makeEdge('e_ab', EdgeType.CALLS, a.id, b.id, 'src/alpha.ts'),
      makeEdge('e_bc', EdgeType.CALLS, b.id, c.id, 'src/beta.ts'),
      makeEdge('e_ac_imp', EdgeType.IMPORTS, a.id, c.id, 'src/alpha.ts'),
      makeEdge('e_ac_contains', EdgeType.CONTAINS, a.id, c.id, 'src/alpha.ts'),
      makeEdge('e_ref', EdgeType.REFERENCES, alone.id, c.id, 'src/lonely.ts'),
    ],
  );
}

export class InMemoryGraphRepository implements GraphRepository {
  constructor(private readonly snapshot: KnowledgeSnapshot) {}

  async getById(id: string): Promise<KnowledgeSnapshot | null> {
    return this.snapshot.id === id ? this.snapshot : null;
  }

  async getLatest(): Promise<KnowledgeSnapshot | null> {
    return this.snapshot;
  }

  async findByUniquenessKey(): Promise<KnowledgeSnapshot | null> {
    return null;
  }

  async save(): Promise<void> {
    throw new Error('not implemented');
  }
}
