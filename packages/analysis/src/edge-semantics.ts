import { EdgeType } from '@corelive/domain';

/**
 * Default edge types for explain/impact neighborhood walks.
 * CONTAINS is structural hierarchy and is excluded unless the caller opts in.
 */
export const DEFAULT_ANALYSIS_EDGE_TYPES: readonly EdgeType[] = [
  EdgeType.CALLS,
  EdgeType.IMPORTS,
  EdgeType.REFERENCES,
] as const;

export type EdgeRole =
  | 'structural_consumer'
  | 'module_binding'
  | 'reference'
  | 'hierarchy'
  | 'unclassified';

export function edgeRole(type: EdgeType): EdgeRole {
  switch (type) {
    case EdgeType.CALLS:
      return 'structural_consumer';
    case EdgeType.IMPORTS:
      return 'module_binding';
    case EdgeType.REFERENCES:
      return 'reference';
    case EdgeType.CONTAINS:
      return 'hierarchy';
    default:
      return 'unclassified';
  }
}

export function describeEdgeSemantics(type: EdgeType): string {
  switch (type) {
    case EdgeType.CALLS:
      return 'Caller invokes the symbol. Reachability is not a confirmed failure.';
    case EdgeType.IMPORTS:
      return 'Module binds or imports the symbol. Import alone does not prove exercise.';
    case EdgeType.REFERENCES:
      return 'Mention that is neither a call nor an import. Weaker review signal.';
    case EdgeType.CONTAINS:
      return 'Hierarchy only (file/class/method nesting). Excluded from dependency walks by default.';
    case EdgeType.RELATED_TO:
      return 'Unmapped Graphify relation. Excluded from default walks.';
    default:
      return `Edge type ${type} is not part of the default analysis walk.`;
  }
}
