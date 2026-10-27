import { rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  CANONICAL_SCHEMA_VERSION,
  GRAPHIFYY_PIN,
} from './boundary/pin.js';
import { GraphifyReader } from './graphify-reader.js';
import { mapGraphifyGraphToSnapshot } from './mapping/graph-mapper.js';
import {
  DefaultGraphifyRunner,
  type GraphifyRunner,
} from './runner/graphify-runner.js';
import { validateGraphifySchema } from './validation/graphify-schema-validator.js';
import { KnowledgeSnapshotValidator } from './validation/knowledge-snapshot-validator.js';
import {
  computeSourceIdentity,
  IndexError,
  type SourceIndexResult,
  type SourceIndexer,
  type IndexSourceRequest,
} from '@corelive/core-engine';
import type { SourceIdentity } from '@corelive/domain';

function identityChanged(
  before: SourceIdentity,
  after: SourceIdentity,
): boolean {
  return (
    before.contentFingerprint !== after.contentFingerprint ||
    before.commitSha !== after.commitSha ||
    before.dirty !== after.dirty
  );
}

export class GraphifySourceIndexer implements SourceIndexer {
  constructor(
    private readonly runner: GraphifyRunner = new DefaultGraphifyRunner(),
    private readonly reader: GraphifyReader = new GraphifyReader(),
    private readonly schemaValidator = validateGraphifySchema,
    private readonly snapshotValidator = new KnowledgeSnapshotValidator(),
  ) {}

  async index(request: IndexSourceRequest): Promise<SourceIndexResult> {
    const repositoryRoot = resolve(request.sourcePath);
    const identityBefore = await computeSourceIdentity(repositoryRoot);

    const outputDirectory = await mkdtemp(
      join(tmpdir(), 'corelive-graphify-'),
    );

    let extractionDurationMs = 0;

    try {
      const execution = await this.runner.execute({
        repositoryPath: repositoryRoot,
        outputDirectory,
        timeoutMs: 10 * 60 * 1000,
      });

      if (!execution.ok) {
        throw new IndexError(
          execution.error,
          'extract',
          `Graphify extraction failed: ${execution.error}`,
        );
      }

      extractionDurationMs = execution.value.durationMs;

      const identityAfter = await computeSourceIdentity(repositoryRoot);
      if (identityChanged(identityBefore, identityAfter)) {
        await rm(outputDirectory, { recursive: true, force: true });
        throw new IndexError(
          'SOURCE_CHANGED_DURING_EXTRACTION',
          'extract',
          'Repository content changed during Graphify extraction',
        );
      }

      return this.buildResult({
        graphJsonPath: execution.value.graphJsonPath,
        identity: identityAfter,
        repositoryRoot,
        durationMs: extractionDurationMs,
      });
    } catch (error) {
      await rm(outputDirectory, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  async indexFromGraphJson(input: {
    graphJsonPath: string;
    identity: SourceIdentity;
    repositoryRoot?: string;
  }): Promise<SourceIndexResult> {
    return this.buildResult({
      graphJsonPath: input.graphJsonPath,
      identity: input.identity,
      repositoryRoot: input.repositoryRoot,
      durationMs: 0,
    });
  }

  private async buildResult(input: {
    graphJsonPath: string;
    identity: SourceIdentity;
    repositoryRoot?: string;
    durationMs: number;
  }): Promise<SourceIndexResult> {
    let rawGraph: unknown;

    try {
      rawGraph = await this.reader.read(input.graphJsonPath);
    } catch (error) {
      throw new IndexError(
        'OUTPUT_MISSING',
        'validate_external',
        `Failed to read graph.json: ${input.graphJsonPath}`,
        { cause: error },
      );
    }

    let graph;
    try {
      graph = this.schemaValidator(rawGraph);
    } catch (error) {
      if (error instanceof IndexError) {
        throw error;
      }
      throw new IndexError(
        'EXTERNAL_SCHEMA_INVALID',
        'validate_external',
        error instanceof Error ? error.message : String(error),
        { cause: error },
      );
    }

    let snapshot;
    try {
      snapshot = mapGraphifyGraphToSnapshot(graph, input.identity, {
        repositoryRoot: input.repositoryRoot,
      });
    } catch (error) {
      throw new IndexError(
        'CANONICAL_MAPPING_FAILED',
        'map',
        error instanceof Error ? error.message : String(error),
        { cause: error },
      );
    }

    try {
      this.snapshotValidator.validate(snapshot);
    } catch (error) {
      if (error instanceof IndexError) {
        throw error;
      }
      throw new IndexError(
        'CANONICAL_VALIDATION_FAILED',
        'validate_canonical',
        error instanceof Error ? error.message : String(error),
        { cause: error },
      );
    }

    return {
      snapshot,
      identity: input.identity,
      warnings: [],
      extraction: {
        extractor: 'graphify',
        extractorVersion: GRAPHIFYY_PIN,
        canonicalSchemaVersion: CANONICAL_SCHEMA_VERSION,
        durationMs: input.durationMs,
      },
    };
  }
}
