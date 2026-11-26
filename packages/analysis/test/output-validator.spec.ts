import { describe, expect, it } from 'vitest';

import {
  parseModelJson,
  validateInferred,
} from '../src/specialist/output-validator.js';

const authorized = {
  nodeIds: new Set(['n1']),
  edgeIds: new Set(['e1']),
  evidenceIds: new Set(['ev1']),
};

describe('validateInferred', () => {
  it('accepts a well-formed hypothesis block', () => {
    const result = validateInferred(
      {
        claims: [],
        responsibility: {
          kind: 'hypothesis',
          text: 'Reserves inventory',
          evidenceRefs: ['n1', 'ev1'],
        },
        participation: null,
        behavior: null,
        motivation: null,
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: [] },
    );
    expect(result.ok).toBe(true);
  });

  it('nulls motivation when rationale is absent instead of inventing one', () => {
    const result = validateInferred(
      {
        claims: [],
        responsibility: null,
        participation: null,
        behavior: null,
        motivation: {
          kind: 'hypothesis',
          text: 'Because the name says so',
          evidenceRefs: ['ev1'],
        },
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: [] },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.motivation).toBeNull();
    }
  });

  it('rejects unauthorized refs', () => {
    const result = validateInferred(
      {
        claims: [],
        responsibility: {
          kind: 'hypothesis',
          text: 'x',
          evidenceRefs: ['ghost'],
        },
        participation: null,
        behavior: null,
        motivation: null,
        consequences: [],
      },
      authorized,
      { rationale: null, authorizedRelations: [] },
    );
    expect(result.ok).toBe(false);
  });

  it('parses fenced JSON', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});
