import { Evidence } from "../evidence/evidence.js";
import { NodeId } from "../ids/node-id.js";
import { EdgeId } from "../ids/edge-id.js";
import { EdgeType } from "./edge-type.js";
export interface GraphEdge<TMetadata = unknown> {

  id: EdgeId;

  type: EdgeType;

  source: NodeId;

  target: NodeId;

  metadata: TMetadata;

  evidence: Evidence[];
}