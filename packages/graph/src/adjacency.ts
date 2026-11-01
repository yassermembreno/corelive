import type { EdgeType, GraphEdge, GraphNode, KnowledgeSnapshot } from '@corelive/domain';

export type AdjacencyIndex = {
  nodesById: Map<string, GraphNode>;
  /** Incoming edges grouped by target node id. */
  incoming: Map<string, GraphEdge[]>;
  /** Outgoing edges grouped by source node id. */
  outgoing: Map<string, GraphEdge[]>;
};

export function buildAdjacencyIndex(snapshot: KnowledgeSnapshot): AdjacencyIndex {
  const nodesById = new Map<string, GraphNode>();
  for (const node of snapshot.nodes) {
    nodesById.set(node.id, node);
  }

  const incoming = new Map<string, GraphEdge[]>();
  const outgoing = new Map<string, GraphEdge[]>();

  for (const edge of snapshot.edges) {
    const outs = outgoing.get(edge.source) ?? [];
    outs.push(edge);
    outgoing.set(edge.source, outs);

    const ins = incoming.get(edge.target) ?? [];
    ins.push(edge);
    incoming.set(edge.target, ins);
  }

  return { nodesById, incoming, outgoing };
}

export function filterEdges(
  edges: GraphEdge[],
  edgeTypes?: readonly EdgeType[],
): GraphEdge[] {
  if (!edgeTypes || edgeTypes.length === 0) {
    return edges;
  }
  const allowed = new Set(edgeTypes);
  return edges.filter((edge) => allowed.has(edge.type));
}
