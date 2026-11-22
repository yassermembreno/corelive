import { EdgeType } from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import {
  checkSemanticFidelity,
  validateInferred,
  type AuthorizedRelation,
} from '../src/specialist/output-validator.js';

/**
 * Fixture mirroring eval/reports/agentic.json before hardening:
 * graph has beta (n_b) -CALLS-> gamma (n_c), but the model claimed "gamma calls beta".
 */
const RELATIONS: AuthorizedRelation[] = [
  {
    edgeId: 'e_bc',
    sourceId: 'n_b',
    targetId: 'n_c',
    type: EdgeType.CALLS,
  },
  {
    edgeId: 'e_ac_imp',
    sourceId: 'n_a',
    targetId: 'n_c',
    type: EdgeType.IMPORTS,
  },
  {
    edgeId: 'e_ref',
    sourceId: 'n_alone',
    targetId: 'n_c',
    type: EdgeType.REFERENCES,
  },
  {
    edgeId: 'e_ac_contains',
    sourceId: 'n_a',
    targetId: 'n_c',
    type: EdgeType.CONTAINS,
  },
];

const authorized = {
  nodeIds: new Set(['n_a', 'n_b', 'n_c', 'n_alone']),
  edgeIds: new Set(['e_bc', 'e_ac_imp', 'e_ref', 'e_ac_contains']),
  evidenceIds: new Set([
    'ev_n_c',
    'ev_e_bc',
    'ev_e_ac_imp',
    'ev_e_ref',
    'ev_e_ac_contains',
  ]),
};

const DEFECT_NARRATIVE =
  ' gamma calls beta and imports alpha, referencing lonely.';

describe('semantic fidelity', () => {
  it('rejects inverted CALLS claim (gamma → beta when graph has beta → gamma)', () => {
    const result = validateInferred(
      {
        claims: [
          {
            subjectId: 'n_c',
            predicate: 'CALLS',
            objectId: 'n_b',
            evidenceRefs: ['e_bc'],
          },
        ],
        responsibility: null,
        participation: {
          kind: 'hypothesis',
          text: DEFECT_NARRATIVE,
          evidenceRefs: ['ev_e_bc'],
        },
        behavior: null,
        motivation: null,
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: RELATIONS },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Inverted relation claim/);
    }
  });

  it('rejects IMPORTS described as CALLS', () => {
    const result = validateInferred(
      {
        claims: [
          {
            subjectId: 'n_a',
            predicate: 'CALLS',
            objectId: 'n_c',
            evidenceRefs: ['e_ac_imp'],
          },
        ],
        responsibility: null,
        participation: null,
        behavior: null,
        motivation: null,
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: RELATIONS },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/type mismatch|Unsupported|does not match/i);
    }
  });

  it('rejects REFERENCES presented as CALLS (execution)', () => {
    const result = validateInferred(
      {
        claims: [
          {
            subjectId: 'n_alone',
            predicate: 'CALLS',
            objectId: 'n_c',
            evidenceRefs: ['e_ref'],
          },
        ],
        responsibility: null,
        participation: null,
        behavior: null,
        motivation: null,
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: RELATIONS },
    );
    expect(result.ok).toBe(false);
  });

  it('rejects hypothesis that cites an edge without a matching claim', () => {
    const result = validateInferred(
      {
        claims: [],
        responsibility: null,
        participation: {
          kind: 'hypothesis',
          text: DEFECT_NARRATIVE,
          evidenceRefs: ['e_bc'],
        },
        behavior: null,
        motivation: null,
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: RELATIONS },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/without a matching claim/);
    }
  });

  it('rejects claim with no matching edge at all', () => {
    const result = validateInferred(
      {
        claims: [
          {
            subjectId: 'n_c',
            predicate: 'CALLS',
            objectId: 'n_alone',
            evidenceRefs: [],
          },
        ],
        responsibility: null,
        participation: null,
        behavior: null,
        motivation: null,
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: RELATIONS },
    );
    expect(result.ok).toBe(false);
  });

  it('accepts faithful claim n_b CALLS n_c with aligned hypothesis', () => {
    const result = validateInferred(
      {
        claims: [
          {
            subjectId: 'n_b',
            predicate: 'CALLS',
            objectId: 'n_c',
            evidenceRefs: ['e_bc', 'ev_e_bc'],
          },
        ],
        responsibility: {
          kind: 'hypothesis',
          text: 'gamma returns a boolean flag',
          evidenceRefs: ['ev_n_c'],
        },
        participation: {
          kind: 'hypothesis',
          text: 'beta calls gamma',
          evidenceRefs: ['e_bc'],
        },
        behavior: null,
        motivation: null,
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: RELATIONS },
    );
    expect(result.ok).toBe(true);
  });

  it('checkSemanticFidelity flags inverted claims for eval', () => {
    const check = checkSemanticFidelity(
      [
        {
          subjectId: 'n_c',
          predicate: 'CALLS',
          objectId: 'n_b',
          evidenceRefs: ['e_bc'],
        },
      ],
      RELATIONS,
    );
    expect(check.ok).toBe(false);
    expect(check.failures.some((f) => f.startsWith('inverted:'))).toBe(true);
  });
});
