import type { SnapshotUniquenessKey } from './persistence/snapshot-uniqueness.js';
import { IndexError } from './errors/index-error.js';
import { isUniqueViolation } from './errors/unique-violation-error.js';
import type { GraphRepository } from './ports/graph-repository.js';
import type { IndexOutcome } from './ports/index-outcome.js';
import type {
  IndexSourceRequest,
  SourceIndexer,
} from './ports/source-indexer.js';

export class IndexRepository {
  constructor(
    private readonly sourceIndexer: SourceIndexer,
    private readonly graphRepository: GraphRepository,
  ) {}

  async index(request: IndexSourceRequest): Promise<IndexOutcome> {
    try {
      const result = await this.sourceIndexer.index(request);

      try {
        await this.graphRepository.save(result.snapshot, result.extraction);
        return {
          status: 'INDEXED',
          snapshotId: result.snapshot.id,
          warnings: result.warnings,
        };
      } catch (error) {
        if (isUniqueViolation(error)) {
          const key = toUniquenessKey(result.snapshot, result.extraction);
          const existing = await this.graphRepository.findByUniquenessKey(key);
          if (existing) {
            return { status: 'UNCHANGED', snapshotId: existing.id };
          }
        }

        return {
          status: 'FAILED',
          stage: 'persist',
          failure: 'PERSISTENCE_FAILED',
          message: error instanceof Error ? error.message : String(error),
        };
      }
    } catch (error) {
      if (error instanceof IndexError) {
        return {
          status: 'FAILED',
          stage: error.stage,
          failure: error.failure,
          message: error.message,
        };
      }

      return {
        status: 'FAILED',
        stage: 'extract',
        failure: 'EXTRACTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

function toUniquenessKey(
  snapshot: { identity: { sourceId: string; contentFingerprint: string } },
  extraction: {
    extractor: string;
    extractorVersion: string;
    canonicalSchemaVersion: string;
  },
): SnapshotUniquenessKey {
  return {
    sourceId: snapshot.identity.sourceId,
    contentFingerprint: snapshot.identity.contentFingerprint,
    extractor: extraction.extractor,
    extractorVersion: extraction.extractorVersion,
    canonicalSchemaVersion: extraction.canonicalSchemaVersion,
  };
}
