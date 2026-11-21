import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { EdgeType } from '@corelive/domain';

import {
  AnalysisReportSchema,
  classifyEvidence,
  runAnalysis,
  silentAnalysisLogger,
  validateInferred,
} from '../src/index.js';
import {
  explainFixtureSnapshot,
  InMemoryGraphRepository,
} from '../test/helpers/in-memory-repo.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../..');
const datasetPath = join(repoRoot, 'eval/dataset.json');
const reportPath = join(repoRoot, 'eval/reports/deterministic.json');

type CaseExpect = {
  ok?: boolean;
  observedName?: string;
  rationaleNull?: boolean;
  inferredNull?: boolean;
  hasCallerNamed?: string;
  outgoingCallsNamed?: string[];
  structuralConsumersNamed?: string[];
  moduleBindingsNamed?: string[];
  hasValidEvidence?: boolean;
  errorCode?: string;
  limitationCodes?: string[];
  truncated?: boolean;
  noContainsInImpact?: boolean;
  relatedTestsAbsent?: boolean;
  evidenceAvailability?: string;
  motivationNulledWhenNoRationale?: boolean;
};

type EvalCase = {
  id: string;
  operation?: 'explain' | 'impact';
  symbol?: string;
  maxDepth?: number;
  kind?: string;
  expect: CaseExpect;
};

type CaseResult = {
  id: string;
  pass: boolean;
  failures: string[];
  latencyMs: number;
};

function names(list: Array<{ name: string }> | undefined): string[] {
  return (list ?? []).map((x) => x.name).sort();
}

function runUnitCase(evalCase: EvalCase): CaseResult {
  const started = performance.now();
  const failures: string[] = [];
  const exp = evalCase.expect;

  if (exp.evidenceAvailability) {
    const result = classifyEvidence(
      {
        id: 'bad',
        source: 'graphify',
        origin: 'ast',
        filePath: 'wrong.ts',
      },
      { filePath: 'right.ts' },
    );
    if (result.availability !== exp.evidenceAvailability) {
      failures.push(
        `expected availability ${exp.evidenceAvailability}, got ${result.availability}`,
      );
    }
  }

  if (exp.motivationNulledWhenNoRationale) {
    const validated = validateInferred(
      {
        responsibility: null,
        participation: null,
        behavior: null,
        motivation: {
          kind: 'hypothesis',
          text: 'Named gamma so it must be important',
          evidenceRefs: [],
        },
        consequences: [],
      },
      {
        nodeIds: new Set(['n']),
        edgeIds: new Set(),
        evidenceIds: new Set(),
      },
      { rationale: null },
    );
    if (!validated.ok || validated.value.motivation !== null) {
      failures.push(
        'motivation must be forced to null when rationale is absent',
      );
    }
  }

  return {
    id: evalCase.id,
    pass: failures.length === 0,
    failures,
    latencyMs: performance.now() - started,
  };
}

async function runAnalysisCase(
  evalCase: EvalCase,
  repo: InMemoryGraphRepository,
): Promise<CaseResult> {
  const started = performance.now();
  const failures: string[] = [];
  const result = await runAnalysis(
    {
      operation: evalCase.operation!,
      symbol: evalCase.symbol!,
      maxDepth: evalCase.maxDepth,
      noModel: true,
    },
    {
      graphRepository: repo,
      model: null,
      logger: silentAnalysisLogger,
    },
  );

  const expectOk = evalCase.expect.ok !== false;
  if (expectOk && !result.ok) {
    failures.push(`expected ok, got error ${result.error.code}`);
    return {
      id: evalCase.id,
      pass: false,
      failures,
      latencyMs: performance.now() - started,
    };
  }

  if (!expectOk) {
    if (result.ok) {
      failures.push('expected error, got ok');
    } else if (
      evalCase.expect.errorCode &&
      result.error.code !== evalCase.expect.errorCode
    ) {
      failures.push(
        `expected ${evalCase.expect.errorCode}, got ${result.error.code}`,
      );
    }
    return {
      id: evalCase.id,
      pass: failures.length === 0,
      failures,
      latencyMs: performance.now() - started,
    };
  }

  if (!result.ok) {
    return {
      id: evalCase.id,
      pass: false,
      failures,
      latencyMs: performance.now() - started,
    };
  }

  const report = result.value;
  const parsed = AnalysisReportSchema.safeParse(report);
  if (!parsed.success) {
    failures.push(`report schema invalid: ${parsed.error.message}`);
  }

  const exp = evalCase.expect;
  if (exp.observedName && report.observed.node.name !== exp.observedName) {
    failures.push(
      `observed name ${report.observed.node.name} != ${exp.observedName}`,
    );
  }
  if (exp.rationaleNull && report.observed.rationale !== null) {
    failures.push('expected rationale null');
  }
  if (exp.inferredNull && report.inferred !== null) {
    failures.push('expected inferred null in deterministic mode');
  }
  if (
    exp.hasCallerNamed &&
    !report.derived.explain?.callers.some((c) => c.name === exp.hasCallerNamed)
  ) {
    failures.push(`missing caller ${exp.hasCallerNamed}`);
  }
  if (exp.outgoingCallsNamed) {
    const got = names(report.derived.explain?.outgoingByType?.[EdgeType.CALLS]);
    if (
      JSON.stringify(got) !==
      JSON.stringify([...exp.outgoingCallsNamed].sort())
    ) {
      failures.push(
        `outgoing CALLS ${JSON.stringify(got)} != ${JSON.stringify(exp.outgoingCallsNamed)}`,
      );
    }
  }
  if (exp.structuralConsumersNamed) {
    const got = names(report.derived.impact?.structuralConsumers);
    if (
      JSON.stringify(got) !==
      JSON.stringify([...exp.structuralConsumersNamed].sort())
    ) {
      failures.push(
        `structuralConsumers ${JSON.stringify(got)} != ${JSON.stringify(exp.structuralConsumersNamed)}`,
      );
    }
  }
  if (exp.moduleBindingsNamed) {
    const got = names(report.derived.impact?.moduleBindings);
    if (
      JSON.stringify(got) !==
      JSON.stringify([...exp.moduleBindingsNamed].sort())
    ) {
      failures.push(
        `moduleBindings ${JSON.stringify(got)} != ${JSON.stringify(exp.moduleBindingsNamed)}`,
      );
    }
  }
  if (exp.hasValidEvidence) {
    if (!report.observed.evidence.some((e) => e.availability === 'valid')) {
      failures.push('expected at least one valid evidence record');
    }
  }
  if (exp.truncated === true && !report.derived.impact?.truncated) {
    failures.push('expected truncated impact walk');
  }
  if (exp.noContainsInImpact) {
    const all = [
      ...(report.derived.impact?.structuralConsumers ?? []),
      ...(report.derived.impact?.moduleBindings ?? []),
      ...(report.derived.impact?.references ?? []),
    ];
    if (all.some((r) => r.edgeType === EdgeType.CONTAINS)) {
      failures.push('CONTAINS present in impact lists');
    }
  }
  if (exp.relatedTestsAbsent) {
    if (report.derived.relatedTests && report.derived.relatedTests.length > 0) {
      failures.push('relatedTests should be absent/empty');
    }
  }
  if (exp.limitationCodes) {
    const codes = new Set(report.limitations.map((l) => l.code));
    for (const code of exp.limitationCodes) {
      if (!codes.has(code)) {
        failures.push(`missing limitation ${code}`);
      }
    }
  }

  return {
    id: evalCase.id,
    pass: failures.length === 0,
    failures,
    latencyMs: performance.now() - started,
  };
}

async function main(): Promise<number> {
  const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as {
    cases: EvalCase[];
  };
  const repo = new InMemoryGraphRepository(explainFixtureSnapshot());
  const results: CaseResult[] = [];

  for (const evalCase of dataset.cases) {
    if (evalCase.kind === 'unit') {
      results.push(runUnitCase(evalCase));
    } else {
      results.push(await runAnalysisCase(evalCase, repo));
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const report = {
    suite: 'deterministic',
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    `deterministic eval: ${passed}/${results.length} passed → ${reportPath}`,
  );
  for (const result of results.filter((r) => !r.pass)) {
    console.error(`FAIL ${result.id}: ${result.failures.join('; ')}`);
  }
  return passed === results.length ? 0 : 1;
}

process.exitCode = await main();
