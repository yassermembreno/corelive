import {
  queryDependencies,
  queryDependents,
  queryEvidence,
  queryPath,
  queryWhoCalls,
  resolveSymbol,
  type EvidenceQueryResult,
  type NeighborHit,
  type PathResult,
  type SymbolCandidate,
} from '@corelive/graph';
import type { EdgeType, KnowledgeSnapshot } from '@corelive/domain';

import type { GraphRepository } from '../ports/graph-repository.js';
import { err, ok, type Result } from '../result.js';

export type QueryError =
  | { code: 'SNAPSHOT_NOT_FOUND'; snapshotId?: string }
  | { code: 'SYMBOL_NOT_FOUND'; symbol: string }
  | {
      code: 'SYMBOL_AMBIGUOUS';
      symbol: string;
      candidates: SymbolCandidate[];
    };

export type SnapshotQueryOptions = {
  snapshotId?: string;
};

export type EdgeFilterOptions = SnapshotQueryOptions & {
  edgeTypes?: readonly EdgeType[];
};

export type PathQueryOptions = SnapshotQueryOptions & {
  maxDepth?: number;
};

export type NeighborQueryResult = {
  snapshotId: string;
  symbol: KnowledgeSnapshot['nodes'][number];
  hits: NeighborHit[];
};

export type PathQueryResult = {
  snapshotId: string;
  from: KnowledgeSnapshot['nodes'][number];
  to: KnowledgeSnapshot['nodes'][number];
  path: PathResult;
};

export type EvidenceServiceResult = {
  snapshotId: string;
  evidence: EvidenceQueryResult;
};

export class SnapshotQueryService {
  constructor(private readonly graphRepository: GraphRepository) {}

  async whoCalls(
    symbol: string,
    options: SnapshotQueryOptions = {},
  ): Promise<Result<NeighborQueryResult, QueryError>> {
    return this.neighborQuery(symbol, options, (snapshot, nodeId) =>
      queryWhoCalls(snapshot, nodeId),
    );
  }

  async dependents(
    symbol: string,
    options: EdgeFilterOptions = {},
  ): Promise<Result<NeighborQueryResult, QueryError>> {
    return this.neighborQuery(symbol, options, (snapshot, nodeId) =>
      queryDependents(snapshot, nodeId, { edgeTypes: options.edgeTypes }),
    );
  }

  async dependencies(
    symbol: string,
    options: EdgeFilterOptions = {},
  ): Promise<Result<NeighborQueryResult, QueryError>> {
    return this.neighborQuery(symbol, options, (snapshot, nodeId) =>
      queryDependencies(snapshot, nodeId, { edgeTypes: options.edgeTypes }),
    );
  }

  async path(
    fromSymbol: string,
    toSymbol: string,
    options: PathQueryOptions = {},
  ): Promise<Result<PathQueryResult, QueryError>> {
    const loaded = await this.loadSnapshot(options.snapshotId);
    if (!loaded.ok) {
      return loaded;
    }
    const snapshot = loaded.value;

    const from = this.resolve(snapshot, fromSymbol);
    if (!from.ok) {
      return from;
    }
    const to = this.resolve(snapshot, toSymbol);
    if (!to.ok) {
      return to;
    }

    return ok({
      snapshotId: snapshot.id,
      from: from.value,
      to: to.value,
      path: queryPath(snapshot, from.value.id, to.value.id, {
        maxDepth: options.maxDepth,
      }),
    });
  }

  async evidence(
    symbol: string,
    options: SnapshotQueryOptions = {},
  ): Promise<Result<EvidenceServiceResult, QueryError>> {
    const loaded = await this.loadSnapshot(options.snapshotId);
    if (!loaded.ok) {
      return loaded;
    }
    const snapshot = loaded.value;

    const resolved = this.resolve(snapshot, symbol);
    if (!resolved.ok) {
      return resolved;
    }

    const evidence = queryEvidence(snapshot, resolved.value.id);
    if (!evidence) {
      return err({ code: 'SYMBOL_NOT_FOUND', symbol });
    }

    return ok({
      snapshotId: snapshot.id,
      evidence,
    });
  }

  private async neighborQuery(
    symbol: string,
    options: SnapshotQueryOptions,
    run: (snapshot: KnowledgeSnapshot, nodeId: string) => NeighborHit[],
  ): Promise<Result<NeighborQueryResult, QueryError>> {
    const loaded = await this.loadSnapshot(options.snapshotId);
    if (!loaded.ok) {
      return loaded;
    }
    const snapshot = loaded.value;

    const resolved = this.resolve(snapshot, symbol);
    if (!resolved.ok) {
      return resolved;
    }

    return ok({
      snapshotId: snapshot.id,
      symbol: resolved.value,
      hits: run(snapshot, resolved.value.id),
    });
  }

  private async loadSnapshot(
    snapshotId?: string,
  ): Promise<Result<KnowledgeSnapshot, QueryError>> {
    const snapshot = snapshotId
      ? await this.graphRepository.getById(snapshotId)
      : await this.graphRepository.getLatest();

    if (!snapshot) {
      return err({
        code: 'SNAPSHOT_NOT_FOUND',
        snapshotId,
      });
    }

    return ok(snapshot);
  }

  private resolve(
    snapshot: KnowledgeSnapshot,
    symbol: string,
  ): Result<KnowledgeSnapshot['nodes'][number], QueryError> {
    const resolved = resolveSymbol(snapshot, symbol);
    if (resolved.status === 'found') {
      return ok(resolved.node);
    }
    if (resolved.status === 'ambiguous') {
      return err({
        code: 'SYMBOL_AMBIGUOUS',
        symbol,
        candidates: resolved.candidates,
      });
    }
    return err({ code: 'SYMBOL_NOT_FOUND', symbol });
  }
}
