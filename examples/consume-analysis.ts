/**
 * External-module consumption demo for @corelive/analysis.
 * Run from the monorepo root:
 *
 *   pnpm exec tsx examples/consume-analysis.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  runAnalysis,
  silentAnalysisLogger,
} from '@corelive/analysis';

import {
  explainFixtureSnapshot,
  InMemoryGraphRepository,
} from '../packages/analysis/test/helpers/in-memory-repo.js';

async function main(): Promise<number> {
  const repo = new InMemoryGraphRepository(explainFixtureSnapshot());

  const result = await runAnalysis(
    {
      operation: 'explain',
      symbol: 'gamma',
      noModel: true,
    },
    {
      graphRepository: repo,
      model: null,
      logger: silentAnalysisLogger,
    },
  );

  if (!result.ok) {
    console.error('consume-analysis failed', result.error);
    return 1;
  }

  const out = join('examples', 'consume-analysis.out.json');
  writeFileSync(out, JSON.stringify(result.value, null, 2));
  console.log(`wrote ${out}`);
  console.log(
    `observed=${result.value.observed.node.name} inferred=${result.value.inferred} limitations=${result.value.limitations.length}`,
  );
  return 0;
}

main().then((code) => {
  process.exitCode = code;
});
