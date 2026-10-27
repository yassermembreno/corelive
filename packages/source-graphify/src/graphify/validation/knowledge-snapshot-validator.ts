import { IndexError } from '@corelive/core-engine';
import type { KnowledgeSnapshot } from '@corelive/domain';

export class KnowledgeSnapshotValidator {
  validate(snapshot: KnowledgeSnapshot): void {
    const nodeIds = new Set<string>();

    for (const node of snapshot.nodes) {
      if (nodeIds.has(node.id)) {
        throw new IndexError(
          'CANONICAL_VALIDATION_FAILED',
          'validate_canonical',
          `Duplicate node id: ${node.id}`,
        );
      }
      nodeIds.add(node.id);
    }

    for (const edge of snapshot.edges) {
      if (!nodeIds.has(edge.source)) {
        throw new IndexError(
          'CANONICAL_VALIDATION_FAILED',
          'validate_canonical',
          `Edge references missing source node: ${edge.source}`,
        );
      }
      if (!nodeIds.has(edge.target)) {
        throw new IndexError(
          'CANONICAL_VALIDATION_FAILED',
          'validate_canonical',
          `Edge references missing target node: ${edge.target}`,
        );
      }
    }
  }
}
