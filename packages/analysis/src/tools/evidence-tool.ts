import type { Evidence, GraphEdge, GraphNode } from '@corelive/domain';

import type { EvidenceRecord } from '../contracts/analysis-report.js';

export type EvidenceLookup =
  | { kind: 'node'; node: GraphNode }
  | { kind: 'edge'; edge: GraphEdge; subject?: GraphNode };

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Classify a single evidence record without reading the filesystem.
 * filePath alone is not enough for `valid`.
 */
export function classifyEvidence(
  evidence: Evidence,
  subject?: { filePath?: string },
): EvidenceRecord {
  const base = {
    id: evidence.id,
    source: evidence.source,
    origin: evidence.origin,
    filePath: evidence.filePath,
    location: evidence.location,
  };

  if (!hasText(evidence.source) || !hasText(evidence.origin)) {
    return {
      ...base,
      availability: 'incomplete',
      reason: 'Missing source or origin provenance.',
    };
  }

  if (evidence.filePath) {
    const expected = subject?.filePath;
    if (expected && evidence.filePath !== expected) {
      return {
        ...base,
        availability: 'incomplete',
        reason: `filePath '${evidence.filePath}' does not match subject path '${expected}'.`,
      };
    }
  }

  return {
    ...base,
    availability: 'valid',
  };
}

export function classifyNodeEvidence(node: GraphNode): EvidenceRecord[] {
  const records = (node.evidence ?? []).map((e) =>
    classifyEvidence(e, { filePath: node.location.filePath }),
  );
  if (records.length === 0) {
    return [
      {
        id: `${node.id}:missing`,
        availability: 'missing',
        reason: 'No evidence records on node.',
      },
    ];
  }
  return records;
}

export function classifyEdgeEvidence(
  edge: GraphEdge,
  subject?: GraphNode,
): EvidenceRecord[] {
  const records = (edge.evidence ?? []).map((e) =>
    classifyEvidence(e, subject ? { filePath: subject.location.filePath } : undefined),
  );
  if (records.length === 0) {
    return [
      {
        id: `${edge.id}:missing`,
        availability: 'missing',
        reason: 'No evidence records on edge.',
      },
    ];
  }
  return records;
}

export class EvidenceTool {
  forNode(node: GraphNode): EvidenceRecord[] {
    return classifyNodeEvidence(node);
  }

  forEdge(edge: GraphEdge, subject?: GraphNode): EvidenceRecord[] {
    return classifyEdgeEvidence(edge, subject);
  }

  lookup(target: EvidenceLookup): EvidenceRecord[] {
    if (target.kind === 'node') {
      return this.forNode(target.node);
    }
    return this.forEdge(target.edge, target.subject);
  }
}
