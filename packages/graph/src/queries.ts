import {
  EdgeType,
  type Evidence,
  type GraphEdge,
  type GraphNode,
  type KnowledgeSnapshot,
} from '@corelive/domain';

import { buildAdjacencyIndex, filterEdges } from './adjacency.js';

export const DEFAULT_PATH_MAX_DEPTH = 20;

export type NeighborHit = {
  node: GraphNode;
  edge: GraphEdge;
};

export type PathFound = {
  status: 'found';
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type PathMissing = {
  status: 'no_path';
  reason: 'NO_PATH' | 'MAX_DEPTH_REACHED';
};

export type PathResult = PathFound | PathMissing;

export type EvidenceQueryResult = {
  node: GraphNode;
  nodeEvidence: Evidence[];
  incidentEdges: Array<{ edge: GraphEdge; evidence: Evidence[] }>;
};

function sortHits(hits: NeighborHit[]): NeighborHit[] {
  return [...hits].sort((a, b) => {
    if (a.node.id < b.node.id) return -1;
    if (a.node.id > b.node.id) return 1;
    if (a.edge.id < b.edge.id) return -1;
    if (a.edge.id > b.edge.id) return 1;
    return 0;
  });
}

function incomingHits(
  snapshot: KnowledgeSnapshot,
  nodeId: string,
  edgeTypes?: readonly EdgeType[],
): NeighborHit[] {
  const index = buildAdjacencyIndex(snapshot);
  const edges = filterEdges(index.incoming.get(nodeId) ?? [], edgeTypes);
  const hits: NeighborHit[] = [];
  for (const edge of edges) {
    const node = index.nodesById.get(edge.source);
    if (node) {
      hits.push({ node, edge });
    }
  }
  return sortHits(hits);
}

function outgoingHits(
  snapshot: KnowledgeSnapshot,
  nodeId: string,
  edgeTypes?: readonly EdgeType[],
): NeighborHit[] {
  const index = buildAdjacencyIndex(snapshot);
  const edges = filterEdges(index.outgoing.get(nodeId) ?? [], edgeTypes);
  const hits: NeighborHit[] = [];
  for (const edge of edges) {
    const node = index.nodesById.get(edge.target);
    if (node) {
      hits.push({ node, edge });
    }
  }
  return sortHits(hits);
}

/** Incoming CALLS only (callers of the resolved callee). */
export function queryWhoCalls(
  snapshot: KnowledgeSnapshot,
  nodeId: string,
): NeighborHit[] {
  return incomingHits(snapshot, nodeId, [EdgeType.CALLS]);
}

/** Incoming edges (any type by default; optional filter). */
export function queryDependents(
  snapshot: KnowledgeSnapshot,
  nodeId: string,
  options?: { edgeTypes?: readonly EdgeType[] },
): NeighborHit[] {
  return incomingHits(snapshot, nodeId, options?.edgeTypes);
}

/** Outgoing edges (any type by default; optional filter). */
export function queryDependencies(
  snapshot: KnowledgeSnapshot,
  nodeId: string,
  options?: { edgeTypes?: readonly EdgeType[] },
): NeighborHit[] {
  return outgoingHits(snapshot, nodeId, options?.edgeTypes);
}

/**
 * Directed BFS shortest path (fewest edges).
 * Neighbors expanded in lexical order by target node id, then edge id.
 */
export function queryPath(
  snapshot: KnowledgeSnapshot,
  fromId: string,
  toId: string,
  options?: { maxDepth?: number },
): PathResult {
  const maxDepth = options?.maxDepth ?? DEFAULT_PATH_MAX_DEPTH;
  const index = buildAdjacencyIndex(snapshot);

  if (!index.nodesById.has(fromId) || !index.nodesById.has(toId)) {
    return { status: 'no_path', reason: 'NO_PATH' };
  }

  if (fromId === toId) {
    return {
      status: 'found',
      nodes: [index.nodesById.get(fromId)!],
      edges: [],
    };
  }

  type Frame = { nodeId: string; depth: number };
  const queue: Frame[] = [{ nodeId: fromId, depth: 0 }];
  const visited = new Set<string>([fromId]);
  const parent = new Map<string, { via: GraphEdge; from: string }>();
  let sawFrontierBeyondMax = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) {
      sawFrontierBeyondMax = true;
      continue;
    }

    const outs = [...(index.outgoing.get(current.nodeId) ?? [])].sort(
      (a, b) => {
        if (a.target < b.target) return -1;
        if (a.target > b.target) return 1;
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
      },
    );

    for (const edge of outs) {
      if (visited.has(edge.target)) {
        continue;
      }
      visited.add(edge.target);
      parent.set(edge.target, { via: edge, from: current.nodeId });

      if (edge.target === toId) {
        return reconstructPath(index.nodesById, parent, fromId, toId);
      }

      queue.push({ nodeId: edge.target, depth: current.depth + 1 });
    }
  }

  return {
    status: 'no_path',
    reason: sawFrontierBeyondMax ? 'MAX_DEPTH_REACHED' : 'NO_PATH',
  };
}

function reconstructPath(
  nodesById: Map<string, GraphNode>,
  parent: Map<string, { via: GraphEdge; from: string }>,
  fromId: string,
  toId: string,
): PathFound {
  const edges: GraphEdge[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const step = parent.get(cursor);
    if (!step) {
      break;
    }
    edges.push(step.via);
    cursor = step.from;
  }
  edges.reverse();

  const nodes: GraphNode[] = [nodesById.get(fromId)!];
  for (const edge of edges) {
    nodes.push(nodesById.get(edge.target)!);
  }

  return { status: 'found', nodes, edges };
}

/** Original node evidence plus incident edge evidence (no invention). */
export function queryEvidence(
  snapshot: KnowledgeSnapshot,
  nodeId: string,
): EvidenceQueryResult | null {
  const index = buildAdjacencyIndex(snapshot);
  const node = index.nodesById.get(nodeId);
  if (!node) {
    return null;
  }

  const incident = [
    ...(index.incoming.get(nodeId) ?? []),
    ...(index.outgoing.get(nodeId) ?? []),
  ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    node,
    nodeEvidence: [...(node.evidence ?? [])],
    incidentEdges: incident.map((edge) => ({
      edge,
      evidence: [...(edge.evidence ?? [])],
    })),
  };
}
