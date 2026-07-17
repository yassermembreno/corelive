/**
 * Base metadata shared by every graph relationship.
 */
export interface EdgeMetadata {
    /**
     * Confidence assigned by the parser.
     *
     * Range: 0.0 - 1.0
     */
    confidence?: number;
  
    /**
     * Language/plugin that produced the edge.
     *
     * Examples:
     *  - typescript
     *  - java
     *  - python
     */
    producer?: string;
  }
  
  /**
   * Metadata for CALLS relationships.
   */
  export interface CallEdgeMetadata extends EdgeMetadata {
    callType?: 'direct' | 'indirect' | 'dynamic';
  
    line?: number;

    async?: boolean; // true if the call is async
  }
  
  /**
   * Metadata for IMPORTS relationships.
   */
  export interface ImportEdgeMetadata extends EdgeMetadata {
    isTypeOnly?: boolean;
  
    moduleSpecifier?: string;

    resolvedPath?: string;    
  }
  
  /**
   * Metadata for API relationships.
   */
  export interface ApiEdgeMetadata extends EdgeMetadata {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  
    path?: string;
  }
  
  /**
   * Metadata for DOCUMENTS relationships.
   */
  export interface DocumentationEdgeMetadata extends EdgeMetadata {
    section?: string;
  }

  export interface ContainsEdgeMetadata extends EdgeMetadata {

    containerType?:
      | 'file'
      | 'module'
      | 'class';
   
   }