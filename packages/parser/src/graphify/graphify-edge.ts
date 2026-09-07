export interface GraphifyEdge {

    source: string;
  
    target: string;
  
    relation: string;
  
    context?: string;
  
    confidence?: string;
  
    confidence_score?: number;
  
    weight?: number;
  
    source_file?: string;
  
    source_location?: string;
  
    _origin?: string;
  
    [key: string]: unknown;
  
  }