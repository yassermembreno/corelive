import { Evidence } from "../evidence/evidence";
import { NodeId } from "../nodes/node-id";
import { EdgeId } from "./edge-id";
import { EdgeType } from "./edge-type";
import { EdgeMetadata } from "./edge-metadata";

export interface KnowledgeEdge {

  id: EdgeId;

  type: EdgeType;

  source: NodeId;

  target: NodeId;

  metadata: EdgeMetadata;

  evidence: Evidence[];
}