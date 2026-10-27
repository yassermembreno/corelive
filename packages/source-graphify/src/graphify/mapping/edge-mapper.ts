import { createDeterministicEdgeId, createEvidenceId } from '@corelive/core-engine';
import { EdgeType, type GraphEdge } from '@corelive/domain';

import type { EdgeMapper } from '../../contracts/edge-mapper.js';
import type { GraphifyEdge } from '../graphify-edge.js';
import { relativizeSourceFile, toGraphifyNodeId } from './node-mapper.js';
import type { GraphifyEdgeMetadata } from './graphify-node-metadata.js';

function mapRelation(relation: string): EdgeType {
  switch (relation) {
    case 'calls':
      return EdgeType.CALLS;
    case 'contains':
      return EdgeType.CONTAINS;
    case 'imports':
    case 'imports_from':
      return EdgeType.IMPORTS;
    case 'references':
      return EdgeType.REFERENCES;
    case 'method':
      return EdgeType.CONTAINS;
    default:
      return EdgeType.RELATED_TO;
  }
}

function normalizeLocation(
  edge: GraphifyEdge,
  repositoryRoot?: string,
): string {
  const filePath = relativizeSourceFile(edge.source_file, repositoryRoot);
  const location = edge.source_location ?? '';
  return filePath ? `${filePath}:${location}` : location;
}

function normalizeEvidence(edge: GraphifyEdge): string {
  return typeof edge._origin === 'string' ? edge._origin : 'unknown';
}

export function mapGraphifyEdge(
  edge: GraphifyEdge,
  options: { repositoryRoot?: string } = {},
): GraphEdge<GraphifyEdgeMetadata> {
  const source = toGraphifyNodeId(edge.source);
  const target = toGraphifyNodeId(edge.target);
  const type = mapRelation(edge.relation);
  const normalizedLocation = normalizeLocation(edge, options.repositoryRoot);
  const normalizedEvidence = normalizeEvidence(edge);
  const filePath = relativizeSourceFile(edge.source_file, options.repositoryRoot);

  return {
    id: createDeterministicEdgeId({
      sourceNodeId: source,
      targetNodeId: target,
      sourceRelation: edge.relation,
      normalizedLocation,
      normalizedEvidence,
    }),
    type,
    source,
    target,
    metadata: {
      producer: 'graphify',
      sourceRelation: edge.relation,
      ...(typeof edge.confidence_score === 'number'
        ? { confidence: edge.confidence_score }
        : {}),
    },
    evidence: [
      {
        id: createEvidenceId(),
        source: 'graphify',
        origin: normalizedEvidence,
        filePath: filePath || undefined,
        location: edge.source_location,
        ...(typeof edge.confidence_score === 'number'
          ? { confidence: edge.confidence_score }
          : {}),
      },
    ],
  };
}

export function deduplicateGraphifyEdges(
  edges: GraphifyEdge[],
  options: { repositoryRoot?: string } = {},
): GraphEdge<GraphifyEdgeMetadata>[] {
  const seen = new Set<string>();
  const mapped: GraphEdge<GraphifyEdgeMetadata>[] = [];

  for (const edge of edges) {
    const graphEdge = mapGraphifyEdge(edge, options);
    if (seen.has(graphEdge.id)) {
      continue;
    }
    seen.add(graphEdge.id);
    mapped.push(graphEdge);
  }

  return mapped;
}

export class GraphifyEdgeMapper implements EdgeMapper<GraphifyEdge> {
  constructor(private readonly repositoryRoot?: string) {}

  map(edge: GraphifyEdge): GraphEdge<GraphifyEdgeMetadata> {
    return mapGraphifyEdge(edge, { repositoryRoot: this.repositoryRoot });
  }
}
