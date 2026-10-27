/**
 * Edge shape observed in graphifyy@0.9.16 `graph.json` (code-only extract).
 *
 * Relations observed on the frozen fixture:
 * contains | imports | imports_from | method | references | calls
 */
export interface GraphifyEdge {
  source: string;

  target: string;

  relation: string;

  context?: string;

  /** Qualitative confidence label, e.g. "EXTRACTED" */
  confidence?: string;

  confidence_score?: number;

  weight?: number;

  source_file?: string;

  source_location?: string;

  _origin?: string;

  [key: string]: unknown;
}

export const GRAPHIFY_RELATIONS_OBSERVED = [
  'calls',
  'contains',
  'imports',
  'imports_from',
  'method',
  'references',
] as const;

export type GraphifyRelationObserved =
  (typeof GRAPHIFY_RELATIONS_OBSERVED)[number];
