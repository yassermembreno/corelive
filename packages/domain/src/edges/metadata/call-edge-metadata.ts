/**
 * Metadata for CALLS relationships.
 */
export interface CallEdgeMetadata {
  callType?: 'direct' | 'indirect' | 'dynamic';

  line?: number;

  async?: boolean;
}
