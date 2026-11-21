import type { GraphRepository } from '@corelive/core-engine';
import { err, ok, type QueryError, type Result } from '@corelive/core-engine';
import { EdgeType, type GraphEdge, type GraphNode, type KnowledgeSnapshot } from '@corelive/domain';
import {
  buildAdjacencyIndex,
  resolveSymbolFriendly,
} from '@corelive/graph';

import type {
  EvidenceRecord,
  ObservedRelation,
} from '../contracts/analysis-report.js';
import { EvidenceTool } from './evidence-tool.js';

export type ComponentQueryResult = {
  snapshot: KnowledgeSnapshot;
  node: GraphNode;
  rationale: string | null;
  localStructure: ObservedRelation[];
  incidentRelations: ObservedRelation[];
  evidence: EvidenceRecord[];
};

function sourceRelation(edge: GraphEdge): string | undefined {
  const meta = edge.metadata as { sourceRelation?: string } | undefined;
  return meta?.sourceRelation;
}

function toObservedRelation(
  edge: GraphEdge,
  evidenceTool: EvidenceTool,
): ObservedRelation {
  // Edge evidence lives at the call/import site — do not require it to match
  // the component node's filePath.
  return {
    edgeId: edge.id,
    type: edge.type,
    sourceId: edge.source,
    targetId: edge.target,
    sourceRelation: sourceRelation(edge),
    evidence: evidenceTool.forEdge(edge),
  };
}

function extractRationale(node: GraphNode, incident: GraphEdge[]): string | null {
  for (const edge of incident) {
    if (
      edge.type === EdgeType.DOCUMENTED_BY ||
      edge.type === EdgeType.DOCUMENTS
    ) {
      const origin = edge.evidence?.[0]?.origin;
      if (origin && origin.trim()) {
        return origin;
      }
    }
    const relation = sourceRelation(edge);
    if (relation === 'rationale_for' || relation === 'cites') {
      const origin = edge.evidence?.[0]?.origin;
      if (origin && origin.trim()) {
        return origin;
      }
    }
  }

  for (const e of node.evidence ?? []) {
    if (e.origin?.toLowerCase().includes('rationale') && e.origin.trim()) {
      return e.origin;
    }
  }

  return null;
}

export class ComponentQueryTool {
  private readonly evidenceTool = new EvidenceTool();

  constructor(private readonly graphRepository: GraphRepository) {}

  async query(
    symbol: string,
    snapshotId?: string,
  ): Promise<Result<ComponentQueryResult, QueryError>> {
    const snapshot = snapshotId
      ? await this.graphRepository.getById(snapshotId)
      : await this.graphRepository.getLatest();

    if (!snapshot) {
      return err({ code: 'SNAPSHOT_NOT_FOUND', snapshotId });
    }

    const resolved = resolveSymbolFriendly(snapshot, symbol);
    if (resolved.status === 'ambiguous') {
      return err({
        code: 'SYMBOL_AMBIGUOUS',
        symbol,
        candidates: resolved.candidates,
      });
    }
    if (resolved.status === 'not_found') {
      return err({ code: 'SYMBOL_NOT_FOUND', symbol });
    }

    const node = resolved.node;
    const index = buildAdjacencyIndex(snapshot);
    const incident = [
      ...(index.incoming.get(node.id) ?? []),
      ...(index.outgoing.get(node.id) ?? []),
    ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const localStructure = incident
      .filter((e) => e.type === EdgeType.CONTAINS)
      .map((e) => toObservedRelation(e, this.evidenceTool));

    const incidentRelations = incident
      .filter((e) => e.type !== EdgeType.CONTAINS)
      .map((e) => toObservedRelation(e, this.evidenceTool));

    return ok({
      snapshot,
      node,
      rationale: extractRationale(node, incident),
      localStructure,
      incidentRelations,
      evidence: this.evidenceTool.forNode(node),
    });
  }
}
