import type { GraphifyEdge } from "./graphify-edge.js";
import type { GraphifyNode } from "./graphify-node.js";

export interface GraphifyGraph {

    directed: boolean;
  
    multigraph: boolean;
  
    graph: Record<string, unknown>;
  
    nodes: GraphifyNode[];
  
    edges: GraphifyEdge[];  
  
  }