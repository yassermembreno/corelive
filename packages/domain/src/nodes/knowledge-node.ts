import { Evidence } from "../evidence/evidence.ts";
import { NodeId } from "./node-id.ts";
import { NodeType } from "./node-type.ts";
import { NodeMetadata } from "./node-metadata.ts";


export interface KnowledgeNode {

  id: NodeId;

  type: NodeType;

  name: string;

  metadata: NodeMetadata;

  evidence: Evidence[];

}



export interface NodeLocation {

  filePath:string;

  startLine?:number;

  endLine?:number;
}