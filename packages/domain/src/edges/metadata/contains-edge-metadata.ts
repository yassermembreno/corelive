/**
 * Metadata for CONTAINS relationships.
 */
export interface ContainsEdgeMetadata {
  containerType?:
    | 'file'
    | 'module'
    | 'class';
}
