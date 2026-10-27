import type { GraphifyEdge } from './graphify-edge.js';
import type { GraphifyNode } from './graphify-node.js';

/**
 * Top-level `graph.json` shape from graphifyy@0.9.16 extract --code-only --no-cluster.
 *
 * Unlike NetworkX-style dumps, this envelope has NO `directed` / `multigraph` / `graph`.
 * Edge list key is `edges` (not `links`).
 */
export interface GraphifyGraph {
  nodes: GraphifyNode[];

  edges: GraphifyEdge[];

  hyperedges?: unknown[];

  input_tokens?: number;

  output_tokens?: number;
}
