import { KnowledgeEdge } from "../edges/knowledge-edge";
import { KnowledgeNode } from "../nodes/knowledge-node";

export interface KnowledgeSnapshot {

    id:string;
  
    createdAt:Date;
  
    nodes: KnowledgeNode[];
  
    edges: KnowledgeEdge[];
  
    source:string;
  
  }