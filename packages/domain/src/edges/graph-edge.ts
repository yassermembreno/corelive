import type { Evidence } from "../evidence/evidence.js";
import type { NodeId } from "../ids/node-id.js";
import type { EdgeId } from "../ids/edge-id.js";
import type { EdgeType } from "./edge-type.js";
export interface GraphEdge<TMetadata = unknown> {

  id: EdgeId;

  type: EdgeType;

  source: NodeId;

  target: NodeId;

  metadata: TMetadata;

  evidence: Evidence[];
}