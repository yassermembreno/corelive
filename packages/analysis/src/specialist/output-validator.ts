import { EdgeType } from '@corelive/domain';

import {
  InferredBlockSchema,
  type InferredBlock,
  type RelationClaim,
} from '../contracts/analysis-report.js';

export type AuthorizedIds = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  evidenceIds: Set<string>;
};

export type AuthorizedRelation = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
};

export type ValidationResult =
  | { ok: true; value: InferredBlock }
  | { ok: false; reason: string };

function collectHypothesisRefs(block: InferredBlock): string[] {
  const refs: string[] = [];
  for (const field of [
    block.responsibility,
    block.participation,
    block.behavior,
    block.motivation,
  ]) {
    if (field) {
      refs.push(...field.evidenceRefs);
    }
  }
  for (const item of block.consequences) {
    refs.push(...item.evidenceRefs);
  }
  for (const claim of block.claims) {
    refs.push(...claim.evidenceRefs);
  }
  return refs;
}

/**
 * Strip known-invalid model fields before schema validation.
 * Does not invent content — only nulls motivation when rationale is absent.
 */
export function sanitizeInferredRaw(
  raw: unknown,
  options: { rationale: string | null },
): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const copy = { ...(raw as Record<string, unknown>) };
  if (options.rationale === null) {
    copy.motivation = null;
  }
  if (!('consequences' in copy)) {
    copy.consequences = [];
  }
  if (!('claims' in copy)) {
    copy.claims = [];
  }
  return copy;
}

function relationKey(
  sourceId: string,
  type: string,
  targetId: string,
): string {
  return `${sourceId}\0${type}\0${targetId}`;
}

function findMatchingRelation(
  claim: RelationClaim,
  relations: readonly AuthorizedRelation[],
): AuthorizedRelation | undefined {
  return relations.find(
    (r) =>
      r.sourceId === claim.subjectId &&
      r.targetId === claim.objectId &&
      r.type === claim.predicate,
  );
}

function findInvertedRelation(
  claim: RelationClaim,
  relations: readonly AuthorizedRelation[],
): AuthorizedRelation | undefined {
  return relations.find(
    (r) =>
      r.sourceId === claim.objectId &&
      r.targetId === claim.subjectId &&
      r.type === claim.predicate,
  );
}

function validateClaims(
  claims: RelationClaim[],
  relations: readonly AuthorizedRelation[],
  authorized: AuthorizedIds,
): string | null {
  const allowed = new Set<string>([
    ...authorized.nodeIds,
    ...authorized.edgeIds,
    ...authorized.evidenceIds,
  ]);
  const byTriple = new Set(
    relations.map((r) => relationKey(r.sourceId, r.type, r.targetId)),
  );

  for (const claim of claims) {
    if (!authorized.nodeIds.has(claim.subjectId)) {
      return `Unauthorized claim subjectId: ${claim.subjectId}`;
    }
    if (!authorized.nodeIds.has(claim.objectId)) {
      return `Unauthorized claim objectId: ${claim.objectId}`;
    }

    const match = findMatchingRelation(claim, relations);
    if (!match) {
      const inverted = findInvertedRelation(claim, relations);
      if (inverted) {
        return (
          `Inverted relation claim: ${claim.subjectId} ${claim.predicate} ${claim.objectId} ` +
          `(graph has ${inverted.sourceId} ${inverted.type} ${inverted.targetId})`
        );
      }
      const sameEndpoints = relations.find(
        (r) =>
          (r.sourceId === claim.subjectId && r.targetId === claim.objectId) ||
          (r.sourceId === claim.objectId && r.targetId === claim.subjectId),
      );
      if (sameEndpoints && sameEndpoints.type !== claim.predicate) {
        return (
          `Relation type mismatch: claimed ${claim.predicate} but graph has ` +
          `${sameEndpoints.sourceId} ${sameEndpoints.type} ${sameEndpoints.targetId}`
        );
      }
      return (
        `Unsupported relation claim: ${claim.subjectId} ${claim.predicate} ${claim.objectId} ` +
        `(no matching authorized edge)`
      );
    }

    if (!byTriple.has(relationKey(claim.subjectId, claim.predicate, claim.objectId))) {
      return `Claim not in authorized graph: ${claim.subjectId} ${claim.predicate} ${claim.objectId}`;
    }

    for (const ref of claim.evidenceRefs) {
      if (!allowed.has(ref)) {
        return `Unauthorized claim evidence ref: ${ref}`;
      }
      if (authorized.edgeIds.has(ref) && ref !== match.edgeId) {
        return (
          `Claim evidence edge ${ref} does not match relation edge ${match.edgeId}`
        );
      }
    }
  }

  return null;
}

/**
 * If hypotheses cite edge ids, require a matching claim for each cited edge.
 */
function validateHypothesisEdgeCoverage(
  block: InferredBlock,
  relations: readonly AuthorizedRelation[],
): string | null {
  const edgeById = new Map(relations.map((r) => [r.edgeId, r]));
  const claimedEdges = new Set<string>();
  for (const claim of block.claims) {
    const match = findMatchingRelation(claim, relations);
    if (match) {
      claimedEdges.add(match.edgeId);
    }
  }

  const hypoRefs = collectHypothesisRefs({
    ...block,
    claims: [],
  });

  for (const ref of hypoRefs) {
    const edge = edgeById.get(ref);
    if (!edge) {
      continue;
    }
    if (!claimedEdges.has(edge.edgeId)) {
      return (
        `Hypothesis cites edge ${ref} without a matching claim ` +
        `(${edge.sourceId} ${edge.type} ${edge.targetId})`
      );
    }
  }

  return null;
}

export function validateInferred(
  raw: unknown,
  authorized: AuthorizedIds,
  options: {
    rationale: string | null;
    authorizedRelations?: readonly AuthorizedRelation[];
  },
): ValidationResult {
  const sanitized = sanitizeInferredRaw(raw, options);
  const parsed = InferredBlockSchema.safeParse(sanitized);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.message };
  }

  const value = parsed.data;
  if (options.rationale === null && value.motivation !== null) {
    return {
      ok: false,
      reason: 'motivation must be null when observed.rationale is null',
    };
  }

  const allowed = new Set<string>([
    ...authorized.nodeIds,
    ...authorized.edgeIds,
    ...authorized.evidenceIds,
  ]);

  for (const ref of collectHypothesisRefs(value)) {
    if (!allowed.has(ref)) {
      return {
        ok: false,
        reason: `Unauthorized evidence ref: ${ref}`,
      };
    }
  }

  const relations = options.authorizedRelations ?? [];
  if (relations.length > 0 || value.claims.length > 0) {
    const claimError = validateClaims(value.claims, relations, authorized);
    if (claimError) {
      return { ok: false, reason: claimError };
    }
    const coverageError = validateHypothesisEdgeCoverage(value, relations);
    if (coverageError) {
      return { ok: false, reason: coverageError };
    }
  }

  return { ok: true, value };
}

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate) as unknown;
}

/** Build authorized relations from observed structure (endpoints + type). */
export function relationsFromObserved(observed: {
  localStructure: Array<{
    edgeId: string;
    sourceId: string;
    targetId: string;
    type: EdgeType;
  }>;
  incidentRelations: Array<{
    edgeId: string;
    sourceId: string;
    targetId: string;
    type: EdgeType;
  }>;
}): AuthorizedRelation[] {
  const map = new Map<string, AuthorizedRelation>();
  for (const rel of [
    ...observed.localStructure,
    ...observed.incidentRelations,
  ]) {
    map.set(rel.edgeId, {
      edgeId: rel.edgeId,
      sourceId: rel.sourceId,
      targetId: rel.targetId,
      type: rel.type,
    });
  }
  return [...map.values()].sort((a, b) =>
    a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0,
  );
}

/**
 * Check structured claims against authorized relations (eval / runtime).
 */
export function checkSemanticFidelity(
  claims: RelationClaim[],
  relations: readonly AuthorizedRelation[],
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const claim of claims) {
    const match = findMatchingRelation(claim, relations);
    if (!match) {
      const inverted = findInvertedRelation(claim, relations);
      if (inverted) {
        failures.push(
          `inverted:${claim.subjectId}-${claim.predicate}->${claim.objectId}`,
        );
      } else {
        failures.push(
          `missing:${claim.subjectId}-${claim.predicate}->${claim.objectId}`,
        );
      }
    }
  }
  return { ok: failures.length === 0, failures };
}
