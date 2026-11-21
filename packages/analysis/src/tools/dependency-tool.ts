import { EdgeType, type KnowledgeSnapshot } from '@corelive/domain';
import {
  queryNeighborhood,
  type NeighborhoodDirection,
  type NeighborhoodResult,
} from '@corelive/graph';

import { DEFAULT_ANALYSIS_EDGE_TYPES } from '../edge-semantics.js';

export type DependencyToolOptions = {
  direction: NeighborhoodDirection;
  maxDepth: number;
  edgeTypes?: readonly EdgeType[];
  /**
   * When true, CONTAINS may be included if present in edgeTypes.
   * Default walks never include CONTAINS unless this flag is set.
   */
  includeContains?: boolean;
};

export type TypedReach = {
  nodeId: string;
  name: string;
  depth: number;
  edgeType: EdgeType;
  pathEdgeIds: string[];
};

export type DependencyToolResult = {
  /** Combined view; prefer `byType` for semantics. */
  neighborhood: NeighborhoodResult | null;
  byType: Map<EdgeType, TypedReach[]>;
  truncated: boolean;
  edgeTypesApplied: EdgeType[];
};

function resolveEdgeTypes(options: DependencyToolOptions): EdgeType[] {
  const requested = [...(options.edgeTypes ?? DEFAULT_ANALYSIS_EDGE_TYPES)];
  if (!options.includeContains) {
    return requested.filter((t) => t !== EdgeType.CONTAINS);
  }
  return requested;
}

function reachesForType(
  neighborhood: NeighborhoodResult,
  edgeType: EdgeType,
): TypedReach[] {
  return [...neighborhood.direct, ...neighborhood.transitive].map((reach) => ({
    nodeId: reach.node.id,
    name: reach.node.name,
    depth: reach.depth,
    edgeType,
    pathEdgeIds: reach.path.map((e) => e.id),
  }));
}

/**
 * Walks each EdgeType independently so CALLS consumers are not collapsed
 * into IMPORTS (or vice versa) by a shared visited set.
 */
export class DependencyTool {
  query(
    snapshot: KnowledgeSnapshot,
    nodeId: string,
    options: DependencyToolOptions,
  ): DependencyToolResult | null {
    const edgeTypes = resolveEdgeTypes(options);
    if (edgeTypes.length === 0) {
      return {
        neighborhood: null,
        byType: new Map(),
        truncated: false,
        edgeTypesApplied: [],
      };
    }

    const byType = new Map<EdgeType, TypedReach[]>();
    let truncated = false;
    let first: NeighborhoodResult | null = null;

    for (const edgeType of edgeTypes) {
      const neighborhood = queryNeighborhood(snapshot, nodeId, {
        direction: options.direction,
        maxDepth: options.maxDepth,
        edgeTypes: [edgeType],
      });
      if (!neighborhood) {
        return null;
      }
      if (!first) {
        first = neighborhood;
      }
      truncated = truncated || neighborhood.truncated;
      byType.set(edgeType, reachesForType(neighborhood, edgeType));
    }

    return {
      neighborhood: first,
      byType,
      truncated,
      edgeTypesApplied: edgeTypes,
    };
  }
}
