import { createSnapshotId } from '@corelive/core-engine';
import { GraphSource, type KnowledgeSnapshot, type SourceIdentity } from '@corelive/domain';

import type { GraphMapper } from '../../contracts/graph-mapper.js';
import type { GraphifyGraph } from '../graphify-graph.js';
import { deduplicateGraphifyEdges } from './edge-mapper.js';
import { mapGraphifyNode } from './node-mapper.js';

export function mapGraphifyGraphToSnapshot(
  graph: GraphifyGraph,
  identity: SourceIdentity,
  options: { repositoryRoot?: string } = {},
): KnowledgeSnapshot {
  return {
    id: createSnapshotId(),
    createdAt: new Date(),
    identity,
    source: GraphSource.GRAPHIFY,
    nodes: graph.nodes.map((node) =>
      mapGraphifyNode(node, { repositoryRoot: options.repositoryRoot }),
    ),
    edges: deduplicateGraphifyEdges(graph.edges, {
      repositoryRoot: options.repositoryRoot,
    }),
  };
}

export class GraphifyGraphMapper implements GraphMapper<GraphifyGraph> {
  constructor(
    private readonly identity: SourceIdentity,
    private readonly repositoryRoot?: string,
  ) {}

  map(graph: GraphifyGraph): KnowledgeSnapshot {
    return mapGraphifyGraphToSnapshot(graph, this.identity, {
      repositoryRoot: this.repositoryRoot,
    });
  }
}
