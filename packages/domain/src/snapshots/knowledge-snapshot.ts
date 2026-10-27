import type { GraphEdge } from "../edges/graph-edge.js";
import type { SnapshotId } from "../ids/snapshot-id.js";
import type { GraphNode } from "../nodes/graph-node.js";
import type { GraphSource } from "../sources/graph-source.js";
import type { SourceIdentity } from "../sources/source-identity.js";

export interface KnowledgeSnapshot {
  id: SnapshotId;

  createdAt: Date;

  identity: SourceIdentity;

  nodes: GraphNode[];

  edges: GraphEdge[];

  source: GraphSource;
}
