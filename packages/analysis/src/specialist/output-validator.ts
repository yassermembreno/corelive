import { EdgeType } from '@corelive/domain';

import {
  InferredBlockSchema,
  type Hypothesis,
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
  /** Evidence record ids attached to this edge in the observed graph. */
  evidenceIds: string[];
};

export type ValidationResult =
  | { ok: true; value: InferredBlock }
  | { ok: false; reason: string };

function hypothesesOf(block: InferredBlock): Hypothesis[] {
  const list: Hypothesis[] = [];
  for (const field of [
    block.responsibility,
    block.participation,
    block.behavior,
    block.motivation,
  ]) {
    if (field) {
      list.push(field);
    }
  }
  list.push(...block.consequences);
  return list;
}

function collectAllRefs(block: InferredBlock): string[] {
  const refs: string[] = [];
  for (const h of hypothesesOf(block)) {
    refs.push(...h.evidenceRefs);
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

/** Build evidenceId → Set&lt;edgeId&gt; from authorized relations. */
export function buildEvidenceToEdgesIndex(
  relations: readonly AuthorizedRelation[],
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const rel of relations) {
    for (const evId of rel.evidenceIds) {
      const set = index.get(evId) ?? new Set<string>();
      set.add(rel.edgeId);
      index.set(evId, set);
    }
  }
  return index;
}

function validateHypothesesHaveEvidence(block: InferredBlock): string | null {
  for (const h of hypothesesOf(block)) {
    if (h.evidenceRefs.length < 1) {
      return 'Non-null hypothesis requires evidenceRefs.length >= 1';
    }
  }
  return null;
}

function validateClaims(
  claims: RelationClaim[],
  relations: readonly AuthorizedRelation[],
  authorized: AuthorizedIds,
  evidenceToEdges: Map<string, Set<string>>,
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

    if (
      !byTriple.has(
        relationKey(claim.subjectId, claim.predicate, claim.objectId),
      )
    ) {
      return `Claim not in authorized graph: ${claim.subjectId} ${claim.predicate} ${claim.objectId}`;
    }

    if (claim.evidenceRefs.length < 1) {
      return `Relation claim requires evidenceRefs for ${claim.subjectId} ${claim.predicate} ${claim.objectId}`;
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
      const linkedEdges = evidenceToEdges.get(ref);
      if (linkedEdges && linkedEdges.size > 0 && !linkedEdges.has(match.edgeId)) {
        return (
          `Claim evidence ${ref} belongs to other edge(s), not ${match.edgeId}`
        );
      }
    }
  }

  return null;
}

/**
 * Relational refs (edgeId or evidenceId tied to edges) require covering claims.
 * Node-only evidence does not force claims — narrative may be non-relational.
 */
function validateRelationalRefCoverage(
  block: InferredBlock,
  relations: readonly AuthorizedRelation[],
  authorized: AuthorizedIds,
  evidenceToEdges: Map<string, Set<string>>,
): string | null {
  const edgeById = new Map(relations.map((r) => [r.edgeId, r]));
  const claimedEdges = new Set<string>();
  for (const claim of block.claims) {
    const match = findMatchingRelation(claim, relations);
    if (match) {
      claimedEdges.add(match.edgeId);
    }
  }

  const hypoRefs: string[] = [];
  for (const h of hypothesesOf(block)) {
    hypoRefs.push(...h.evidenceRefs);
  }

  for (const ref of hypoRefs) {
    if (edgeById.has(ref)) {
      if (!claimedEdges.has(ref)) {
        const edge = edgeById.get(ref)!;
        return (
          `Hypothesis cites edge ${ref} without a matching claim ` +
          `(${edge.sourceId} ${edge.type} ${edge.targetId})`
        );
      }
      continue;
    }

    const linked = evidenceToEdges.get(ref);
    if (!linked || linked.size === 0) {
      // Node/doc evidence — non-relational narrative OK without claims.
      continue;
    }

    if (linked.size === 1) {
      const only = [...linked][0]!;
      if (!claimedEdges.has(only)) {
        return (
          `Hypothesis cites evidence ${ref} for edge ${only} without a matching claim`
        );
      }
      continue;
    }

    // evidenceId maps to multiple edges — claim must disambiguate.
    const covered = [...linked].filter((id) => claimedEdges.has(id));
    if (covered.length === 0) {
      return (
        `Hypothesis cites ambiguous evidence ${ref} linked to edges ` +
        `${[...linked].sort().join(', ')} without a disambiguating claim`
      );
    }
  }

  // Claim evidence refs already checked in validateClaims.
  void authorized;
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

  const evidenceError = validateHypothesesHaveEvidence(value);
  if (evidenceError) {
    return { ok: false, reason: evidenceError };
  }

  const allowed = new Set<string>([
    ...authorized.nodeIds,
    ...authorized.edgeIds,
    ...authorized.evidenceIds,
  ]);

  for (const ref of collectAllRefs(value)) {
    if (!allowed.has(ref)) {
      return {
        ok: false,
        reason: `Unauthorized evidence ref: ${ref}`,
      };
    }
  }

  const relations = options.authorizedRelations ?? [];
  const evidenceToEdges = buildEvidenceToEdgesIndex(relations);

  if (relations.length > 0 || value.claims.length > 0) {
    const claimError = validateClaims(
      value.claims,
      relations,
      authorized,
      evidenceToEdges,
    );
    if (claimError) {
      return { ok: false, reason: claimError };
    }
    const coverageError = validateRelationalRefCoverage(
      value,
      relations,
      authorized,
      evidenceToEdges,
    );
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

/** Build authorized relations from observed structure (endpoints + type + evidence). */
export function relationsFromObserved(observed: {
  localStructure: Array<{
    edgeId: string;
    sourceId: string;
    targetId: string;
    type: EdgeType;
    evidence?: Array<{ id: string }>;
  }>;
  incidentRelations: Array<{
    edgeId: string;
    sourceId: string;
    targetId: string;
    type: EdgeType;
    evidence?: Array<{ id: string }>;
  }>;
}): AuthorizedRelation[] {
  const map = new Map<string, AuthorizedRelation>();
  for (const rel of [
    ...observed.localStructure,
    ...observed.incidentRelations,
  ]) {
    const evidenceIds = (rel.evidence ?? [])
      .map((e) => e.id)
      .filter(Boolean)
      .sort();
    const existing = map.get(rel.edgeId);
    if (existing) {
      const merged = new Set([...existing.evidenceIds, ...evidenceIds]);
      existing.evidenceIds = [...merged].sort();
    } else {
      map.set(rel.edgeId, {
        edgeId: rel.edgeId,
        sourceId: rel.sourceId,
        targetId: rel.targetId,
        type: rel.type,
        evidenceIds,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0,
  );
}

/**
 * Check structured claims against authorized relations (eval claimFidelity).
 */
export function checkClaimFidelity(
  claims: RelationClaim[],
  relations: readonly AuthorizedRelation[],
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const evidenceToEdges = buildEvidenceToEdgesIndex(relations);
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
      continue;
    }
    for (const ref of claim.evidenceRefs) {
      if (ref !== match.edgeId && relations.some((r) => r.edgeId === ref)) {
        failures.push(`wrong_edge_evidence:${ref}!=${match.edgeId}`);
      }
      const linked = evidenceToEdges.get(ref);
      if (linked && linked.size > 0 && !linked.has(match.edgeId)) {
        failures.push(`evidence_other_edge:${ref}`);
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

/** @deprecated Use checkClaimFidelity — kept as alias for existing imports. */
export const checkSemanticFidelity = checkClaimFidelity;

export function computeEvidenceCoverage(block: InferredBlock | null): {
  hypothesisCount: number;
  withEvidence: number;
  ratio: number;
} {
  if (!block) {
    return { hypothesisCount: 0, withEvidence: 0, ratio: 1 };
  }
  const hypos = hypothesesOf(block);
  const withEvidence = hypos.filter((h) => h.evidenceRefs.length >= 1).length;
  return {
    hypothesisCount: hypos.length,
    withEvidence,
    ratio: hypos.length === 0 ? 1 : withEvidence / hypos.length,
  };
}
