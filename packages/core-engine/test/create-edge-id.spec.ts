import { describe, expect, it } from 'vitest';

import { createDeterministicEdgeId } from '../src/ids/create-edge-id.js';

describe('createDeterministicEdgeId', () => {
  it('is stable for the same structural inputs', () => {
    const input = {
      sourceNodeId: 'graphify:a',
      targetNodeId: 'graphify:b',
      sourceRelation: 'calls',
      normalizedLocation: 'src/a.ts:L7',
      normalizedEvidence: 'ast',
    };

    expect(createDeterministicEdgeId(input)).toBe(
      createDeterministicEdgeId(input),
    );
  });

  it('does not depend on call order / position index', () => {
    const a = createDeterministicEdgeId({
      sourceNodeId: 'graphify:a',
      targetNodeId: 'graphify:b',
      sourceRelation: 'calls',
      normalizedLocation: 'src/a.ts:L7',
      normalizedEvidence: 'ast',
    });
    const b = createDeterministicEdgeId({
      sourceNodeId: 'graphify:a',
      targetNodeId: 'graphify:b',
      sourceRelation: 'calls',
      normalizedLocation: 'src/a.ts:L7',
      normalizedEvidence: 'ast',
    });

    expect(a).toBe(b);
  });

  it('changes when relation or location changes', () => {
    const base = {
      sourceNodeId: 'graphify:a',
      targetNodeId: 'graphify:b',
      sourceRelation: 'calls',
      normalizedLocation: 'src/a.ts:L7',
      normalizedEvidence: 'ast',
    };

    expect(
      createDeterministicEdgeId({
        ...base,
        sourceRelation: 'imports',
      }),
    ).not.toBe(createDeterministicEdgeId(base));

    expect(
      createDeterministicEdgeId({
        ...base,
        normalizedLocation: 'src/a.ts:L8',
      }),
    ).not.toBe(createDeterministicEdgeId(base));
  });
});
