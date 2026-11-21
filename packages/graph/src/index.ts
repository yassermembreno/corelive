export {
  buildAdjacencyIndex,
  filterEdges,
  type AdjacencyIndex,
} from './adjacency.js';
export {
  DEFAULT_NEIGHBORHOOD_MAX_DEPTH,
  DEFAULT_PATH_MAX_DEPTH,
  queryDependencies,
  queryDependents,
  queryEvidence,
  queryNeighborhood,
  queryPath,
  queryWhoCalls,
  type EvidenceQueryResult,
  type NeighborhoodDirection,
  type NeighborhoodOptions,
  type NeighborhoodReach,
  type NeighborhoodResult,
  type NeighborHit,
  type PathFound,
  type PathMissing,
  type PathResult,
} from './queries.js';
export {
  resolveSymbol,
  type ResolveSymbolResult,
  type SymbolCandidate,
} from './resolve-symbol.js';
export {
  resolveSymbolFriendly,
  symbolExpansions,
} from './resolve-symbol-friendly.js';
