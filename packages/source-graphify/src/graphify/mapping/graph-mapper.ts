import { createSnapshotId } from '@corelive/core-engine';
import { GraphSource, type KnowledgeSnapshot, type SourceIdentity } from '@corelive/domain';

import type { GraphMapper } from '../../contracts/graph-mapper.js';
import type { GraphifyGraph } from '../graphify-graph.js';
import { deduplicateGraphifyEdges } from './edge-mapper.js';
import {
  mapGraphifyNode,
  type RelativizeSourceFileOptions,
} from './node-mapper.js';

export function mapGraphifyGraphToSnapshot(
  graph: GraphifyGraph,
  identity: SourceIdentity,
  options: RelativizeSourceFileOptions = {},
): KnowledgeSnapshot {
  return {
    id: createSnapshotId(),
    createdAt: new Date(),
    identity,
    source: GraphSource.GRAPHIFY,
    nodes: graph.nodes.map((node) => mapGraphifyNode(node, options)),
    edges: deduplicateGraphifyEdges(graph.edges, options),
  };
}

export class GraphifyGraphMapper implements GraphMapper<GraphifyGraph> {
  constructor(
    private readonly identity: SourceIdentity,
    private readonly options: RelativizeSourceFileOptions = {},
  ) {}

  map(graph: GraphifyGraph): KnowledgeSnapshot {
    return mapGraphifyGraphToSnapshot(graph, this.identity, this.options);
  }
}
