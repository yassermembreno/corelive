import { GraphEdge } from "../edges/graph-edge.js";
import { SnapshotId } from "../ids/snapshot-id.js";
import { GraphNode } from "../nodes/graph-node.js";
import { GraphSource } from "../sources/Graph-source.js";

export interface GraphSnapshot {

    id:SnapshotId;
  
    createdAt:Date;
  
    nodes: GraphNode[];
  
    edges: GraphEdge[];
  
    source: GraphSource;
  
  }