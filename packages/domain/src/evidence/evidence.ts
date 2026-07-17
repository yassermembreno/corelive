import { EvidenceId } from "../ids/evidence-id.js";

export interface Evidence {

    id: EvidenceId;
    
    source: string;
  
    origin: string;
  
    filePath?: string;
  
    location?: string;
  
    confidence?: number;
  
  }