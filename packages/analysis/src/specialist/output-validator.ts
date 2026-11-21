import {
  InferredBlockSchema,
  type InferredBlock,
} from '../contracts/analysis-report.js';

export type AuthorizedIds = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  evidenceIds: Set<string>;
};

export type ValidationResult =
  | { ok: true; value: InferredBlock }
  | { ok: false; reason: string };

function collectRefs(block: InferredBlock): string[] {
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
  return refs;
}

export function validateInferred(
  raw: unknown,
  authorized: AuthorizedIds,
  options: { rationale: string | null },
): ValidationResult {
  const parsed = InferredBlockSchema.safeParse(raw);
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

  for (const ref of collectRefs(value)) {
    if (!allowed.has(ref)) {
      return {
        ok: false,
        reason: `Unauthorized evidence ref: ${ref}`,
      };
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
