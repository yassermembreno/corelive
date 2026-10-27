import type { EdgeMetadata } from '@corelive/domain';

export interface GraphifyNodeMetadata {
  producer: 'graphify';
  sourceFile?: string;
  sourceLocation?: string;
  sourceType?: string;
}

export interface GraphifyEdgeMetadata extends EdgeMetadata {
  producer: 'graphify';
}
