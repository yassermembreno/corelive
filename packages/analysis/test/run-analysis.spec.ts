import { describe, expect, it } from 'vitest';

import { runAnalysis } from '../src/run-analysis.js';
import { silentAnalysisLogger } from '../src/logging.js';
import {
  explainFixtureSnapshot,
  InMemoryGraphRepository,
} from './helpers/in-memory-repo.js';

describe('runAnalysis', () => {
  const repo = new InMemoryGraphRepository(explainFixtureSnapshot());

  it('explains a component without a model', async () => {
    const result = await runAnalysis(
      { operation: 'explain', symbol: 'gamma', noModel: true },
      { graphRepository: repo, model: null, logger: silentAnalysisLogger },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.observed.node.name).toBe('gamma');
    expect(result.value.observed.rationale).toBeNull();
    expect(result.value.inferred).toBeNull();
    expect(result.value.derived.explain?.callers.some((c) => c.name === 'beta')).toBe(
      true,
    );
    expect(
      result.value.limitations.some((l) => l.code === 'RATIONALE_ABSENT'),
    ).toBe(true);
  });

  it('separates CALLS, IMPORTS, and excludes CONTAINS in impact', async () => {
    const result = await runAnalysis(
      { operation: 'impact', symbol: 'gamma', noModel: true, maxDepth: 3 },
      { graphRepository: repo, model: null, logger: silentAnalysisLogger },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const impact = result.value.derived.impact!;
    expect(impact.structuralConsumers.map((r) => r.name).sort()).toEqual([
      'alpha',
      'beta',
    ]);
    expect(impact.moduleBindings.map((r) => r.name)).toEqual(['alpha']);
    expect(impact.references.map((r) => r.name)).toEqual(['lonely']);
    expect(
      [...impact.structuralConsumers, ...impact.moduleBindings].every(
        (r) => r.edgeType !== 'CONTAINS',
      ),
    ).toBe(true);
    expect(
      result.value.limitations.some((l) => l.code === 'CONTAINS_EXCLUDED'),
    ).toBe(true);
  });

  it('returns SYMBOL_AMBIGUOUS for duplicate names', async () => {
    const result = await runAnalysis(
      { operation: 'explain', symbol: 'format', noModel: true },
      { graphRepository: repo, model: null, logger: silentAnalysisLogger },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SYMBOL_AMBIGUOUS');
  });

  it('rejects invalid requests', async () => {
    const result = await runAnalysis(
      { operation: 'explain' },
      { graphRepository: repo, logger: silentAnalysisLogger },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_REQUEST');
  });
});
