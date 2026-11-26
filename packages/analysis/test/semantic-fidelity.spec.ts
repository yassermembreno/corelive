import { EdgeType } from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import {
  checkClaimFidelity,
  validateInferred,
  type AuthorizedRelation,
} from '../src/specialist/output-validator.js';

/**
 * Fixture: beta (n_b) -CALLS-> gamma (n_c).
 * Historical defect: model claimed gamma calls beta.
 */
const RELATIONS: AuthorizedRelation[] = [
  {
    edgeId: 'e_bc',
    sourceId: 'n_b',
    targetId: 'n_c',
    type: EdgeType.CALLS,
    evidenceIds: ['ev_e_bc', 'ev_shared'],
  },
  {
    edgeId: 'e_ac_imp',
    sourceId: 'n_a',
    targetId: 'n_c',
    type: EdgeType.IMPORTS,
    evidenceIds: ['ev_e_ac_imp', 'ev_shared'],
  },
  {
    edgeId: 'e_ref',
    sourceId: 'n_alone',
    targetId: 'n_c',
    type: EdgeType.REFERENCES,
    evidenceIds: ['ev_e_ref'],
  },
  {
    edgeId: 'e_ac_contains',
    sourceId: 'n_a',
    targetId: 'n_c',
    type: EdgeType.CONTAINS,
    evidenceIds: ['ev_e_ac_contains'],
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
    'ev_shared',
  ]),
};

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
          text: 'gamma calls beta',
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

  it('rejects hypothesis without evidence', () => {
    const result = validateInferred(
      {
        claims: [],
        responsibility: {
          kind: 'hypothesis',
          text: 'does something',
          evidenceRefs: [],
        },
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
      expect(result.reason).toMatch(/evidenceRefs\.length >= 1/);
    }
  });

  it('rejects claim evidence belonging to a different edge', () => {
    const result = validateInferred(
      {
        claims: [
          {
            subjectId: 'n_b',
            predicate: 'CALLS',
            objectId: 'n_c',
            evidenceRefs: ['ev_e_ac_imp'],
          },
        ],
        responsibility: {
          kind: 'hypothesis',
          text: 'gamma returns a flag',
          evidenceRefs: ['ev_n_c'],
        },
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
      expect(result.reason).toMatch(/belongs to other edge/);
    }
  });

  it('rejects ambiguous evidenceId without a disambiguating claim', () => {
    const result = validateInferred(
      {
        claims: [],
        responsibility: null,
        participation: {
          kind: 'hypothesis',
          text: 'related somehow',
          evidenceRefs: ['ev_shared'],
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
      expect(result.reason).toMatch(/ambiguous evidence|disambiguating claim/);
    }
  });

  it('rejects edgeId citation without a matching claim', () => {
    const result = validateInferred(
      {
        claims: [],
        responsibility: null,
        participation: {
          kind: 'hypothesis',
          text: 'mentions a call',
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

  it('accepts non-relational narrative without claims when node evidence is valid', () => {
    const result = validateInferred(
      {
        claims: [],
        responsibility: {
          kind: 'hypothesis',
          text: 'gamma appears to return a boolean',
          evidenceRefs: ['ev_n_c'],
        },
        participation: null,
        behavior: null,
        motivation: null,
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: RELATIONS },
    );
    expect(result.ok).toBe(true);
  });

  it('accepts faithful claims; contradictory free text is not auto-rejected (documented limit)', () => {
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
          // Contradicts the graph in prose, but claims are correct.
          // Validator certifies claims only — free text is not invalidated here.
          kind: 'hypothesis',
          text: 'gamma calls beta',
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
    if (result.ok) {
      expect(result.value.claims[0]?.subjectId).toBe('n_b');
      expect(result.value.participation?.text).toMatch(/gamma calls beta/);
    }
  });

  it('accepts faithful claim with aligned hypothesis', () => {
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

  it('checkClaimFidelity flags inverted claims', () => {
    const check = checkClaimFidelity(
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
