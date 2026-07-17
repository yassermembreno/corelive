import { Evidence } from "../evidence/evidence.js";
import { NodeId } from "../ids/node-id.js";
import { NodeType } from "./node-type.js";


export interface GraphNode<TMetadata = unknown> {

  id: NodeId;

  type: NodeType;

  name: string;

  metadata: TMetadata;

  location: NodeLocation;

  evidence: Evidence[];

}



export interface NodeLocation {

  filePath:string;

  startLine?:number;

  endLine?:number;
}