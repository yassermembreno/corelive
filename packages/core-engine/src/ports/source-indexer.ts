import type { KnowledgeSnapshot, SourceIdentity } from '@corelive/domain';

import type { IndexWarning } from './index-outcome.js';

export interface IndexSourceRequest {
  sourcePath: string;
}

export interface ExtractionDescriptor {
  extractor: 'graphify';
  extractorVersion: string;
  canonicalSchemaVersion: string;
  durationMs: number;
}

export interface SourceIndexResult {
  snapshot: KnowledgeSnapshot;
  identity: SourceIdentity;
  warnings: IndexWarning[];
  extraction: ExtractionDescriptor;
}

export interface SourceIndexer {
  index(request: IndexSourceRequest): Promise<SourceIndexResult>;
}
