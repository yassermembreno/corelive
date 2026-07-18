/**
 * Metadata for API relationships.
 */
export interface ApiEdgeMetadata {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  path?: string;
}
