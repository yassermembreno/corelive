import type { GraphEdge } from "../edges/graph-edge.js";
import type { SnapshotId } from "../ids/snapshot-id.js";
import type { GraphNode } from "../nodes/graph-node.js";
import type { GraphSource } from "../sources/Graph-source.js";

export interface KnowledgeSnapshot {

    id:SnapshotId;
  
    createdAt:Date;
  
    nodes: GraphNode[];
  
    edges: GraphEdge[];
  
    source: GraphSource;  
  }