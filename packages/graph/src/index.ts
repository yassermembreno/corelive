export {
  buildAdjacencyIndex,
  filterEdges,
  type AdjacencyIndex,
} from './adjacency.js';
export {
  DEFAULT_PATH_MAX_DEPTH,
  queryDependencies,
  queryDependents,
  queryEvidence,
  queryPath,
  queryWhoCalls,
  type EvidenceQueryResult,
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
