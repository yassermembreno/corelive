export interface GraphifyNode {

    id: string;
  
    label: string;
  
    file_type?: string;
  
    source_file?: string;
  
    source_location?: string;
  
    community?: number;
  
    community_name?: string;
  
    norm_label?: string;
  
    _origin?: string;
  
    [key: string]: unknown;
  
  }