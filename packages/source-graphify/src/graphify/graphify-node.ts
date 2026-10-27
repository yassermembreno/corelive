/**
 * Node shape observed in graphifyy@0.9.16 `graph.json` (code-only extract).
 */
export interface GraphifyNode {
  id: string;

  label: string;

  file_type?: string;

  source_file?: string;

  source_location?: string;

  /** e.g. "ast" */
  _origin?: string;

  community?: number;

  community_name?: string;

  norm_label?: string;

  [key: string]: unknown;
}
