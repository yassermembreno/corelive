import { createHash } from 'node:crypto';

import type { EdgeId } from '@corelive/domain';

/**
 * Deterministic EdgeId.
 *
 * Hash of structural identity — never an array index (Graphify edge order
 * is not a stable identity). Completely identical edges collide and must
 * be deduplicated or treated as a structural duplicate.
 */
export function createDeterministicEdgeId(input: {
  sourceNodeId: string;
  targetNodeId: string;
  sourceRelation: string;
  normalizedLocation: string;
  normalizedEvidence: string;
}): EdgeId {
  const payload = [
    input.sourceNodeId,
    input.targetNodeId,
    input.sourceRelation,
    input.normalizedLocation,
    input.normalizedEvidence,
  ].join('\0');

  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
