import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { EdgeType } from '@corelive/domain';

import {
  AnalysisReportSchema,
  OllamaAdapter,
  checkClaimFidelity,
  computeEvidenceCoverage,
  relationsFromObserved,
  runAnalysis,
  silentAnalysisLogger,
  type AnalysisReport,
  type LanguageModel,
} from '../src/index.js';
import {
  explainFixtureSnapshot,
  InMemoryGraphRepository,
} from '../test/helpers/in-memory-repo.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../..');
const reportPath = join(repoRoot, 'eval/reports/agentic.json');

type RubricScores = {
  concise: boolean;
  separatesHypothesis: boolean;
  noMotivationFromName: boolean;
  noImportAsBehavior: boolean;
  noPathAsFailure: boolean;
  unsupportedClaims: string[];
};

function scoreRubric(report: AnalysisReport): RubricScores {
  const unsupportedClaims: string[] = [];
  const inferred = report.inferred;
  const separatesHypothesis = inferred
    ? [
        inferred.responsibility,
        inferred.participation,
        inferred.behavior,
        inferred.motivation,
        ...inferred.consequences,
      ]
        .filter(Boolean)
        .every((h) => h && h.kind === 'hypothesis')
    : false;

  const text = JSON.stringify(inferred ?? {}).toLowerCase();
  const noMotivationFromName =
    report.observed.rationale === null &&
    (inferred?.motivation === null || inferred === null);
  if (!noMotivationFromName) {
    unsupportedClaims.push('motivation without rationale');
  }
  const noImportAsBehavior =
    !text.includes('import proves') &&
    !text.includes('import demonstrates behavior');
  const noPathAsFailure =
    !text.includes('will break production') &&
    !text.includes('confirmed failure') &&
    !text.includes('definitely fails');
  const concise =
    !inferred ||
    [
      inferred.responsibility?.text,
      inferred.participation?.text,
      inferred.behavior?.text,
    ]
      .filter(Boolean)
      .every((t) => (t?.length ?? 0) <= 400);

  if (!noImportAsBehavior) unsupportedClaims.push('import treated as behavior');
  if (!noPathAsFailure) unsupportedClaims.push('path treated as failure');

  return {
    concise,
    separatesHypothesis,
    noMotivationFromName,
    noImportAsBehavior,
    noPathAsFailure,
    unsupportedClaims,
  };
}

/**
 * Limited free-text heuristic from report callers — not a fidelity guarantee.
 * Derived from graph names; no fixture-specific gamma/beta literals.
 */
function narrativeHeuristicChecks(report: AnalysisReport): {
  ok: boolean;
  findings: string[];
} {
  const findings: string[] = [];
  const inferred = report.inferred;
  if (!inferred) {
    return { ok: true, findings };
  }

  const narrative = [
    inferred.responsibility?.text,
    inferred.participation?.text,
    inferred.behavior?.text,
    ...inferred.consequences.map((c) => c.text),
  ]
    .filter(Boolean)
    .join(' ');

  const symbolName = report.observed.node.name;
  const callers = report.derived.explain?.callers ?? [];
  for (const caller of callers) {
    if (caller.edgeType !== EdgeType.CALLS) {
      continue;
    }
    const pattern = new RegExp(
      `${escapeRegExp(symbolName)}\\s+calls\\s+${escapeRegExp(caller.name)}`,
      'i',
    );
    if (pattern.test(narrative)) {
      findings.push(
        `possible_inverted_caller_narrative:${symbolName}->${caller.name}`,
      );
    }
  }

  return { ok: findings.length === 0, findings };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function probeOllama(model: LanguageModel): Promise<boolean> {
  try {
    await model.complete({
      system: 'Reply with JSON {"ok":true}',
      prompt: '{"ping":true}',
      timeoutMs: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<number> {
  const started = performance.now();
  const model = new OllamaAdapter();
  const available = await probeOllama(model);

  if (!available) {
    const blocked = {
      suite: 'agentic',
      status: 'blocked',
      reason:
        'Ollama unavailable or model not reachable. Agentic evaluation is incomplete — do not treat --no-model as a substitute.',
      host: process.env.CORELIVE_OLLAMA_HOST ?? 'http://127.0.0.1:11434',
      model: process.env.CORELIVE_MODEL ?? 'llama3.2',
      generatedAt: new Date().toISOString(),
      latencyMs: performance.now() - started,
      note: 'claimFidelity is not a guarantee of full explanation fidelity.',
    };
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(blocked, null, 2));
    console.error(`agentic eval BLOCKED → ${reportPath}`);
    return 2;
  }

  const repo = new InMemoryGraphRepository(explainFixtureSnapshot());
  const result = await runAnalysis(
    {
      operation: 'explain',
      symbol: 'gamma',
      noModel: false,
    },
    {
      graphRepository: repo,
      model,
      logger: silentAnalysisLogger,
      limits: { modelTimeoutMs: 60_000 },
    },
  );

  if (!result.ok) {
    const failed = {
      suite: 'agentic',
      status: 'failed',
      reason: result.error,
      generatedAt: new Date().toISOString(),
    };
    writeFileSync(reportPath, JSON.stringify(failed, null, 2));
    return 1;
  }

  const report = result.value;
  const schemaOk = AnalysisReportSchema.safeParse(report).success;
  const rubric = scoreRubric(report);

  const allowed = new Set<string>([report.observed.node.id]);
  for (const e of report.observed.evidence) allowed.add(e.id);
  for (const rel of [
    ...report.observed.localStructure,
    ...report.observed.incidentRelations,
  ]) {
    allowed.add(rel.edgeId);
    allowed.add(rel.sourceId);
    allowed.add(rel.targetId);
    for (const ev of rel.evidence) allowed.add(ev.id);
  }
  const inferredRefs: string[] = [];
  if (report.inferred) {
    for (const field of [
      report.inferred.responsibility,
      report.inferred.participation,
      report.inferred.behavior,
      report.inferred.motivation,
      ...report.inferred.consequences,
    ]) {
      if (field) inferredRefs.push(...field.evidenceRefs);
    }
    for (const claim of report.inferred.claims) {
      inferredRefs.push(...claim.evidenceRefs, claim.subjectId, claim.objectId);
    }
  }
  const refsAuthorized = inferredRefs.every((id) => allowed.has(id));

  const relations = relationsFromObserved(report.observed);
  const claims = report.inferred?.claims ?? [];
  const claimCheck = checkClaimFidelity(claims, relations);
  const claimFidelity = report.inferred !== null && claimCheck.ok;

  const narrative = narrativeHeuristicChecks(report);
  const evidenceCoverage = computeEvidenceCoverage(report.inferred);

  // Suite pass: schema + model output + claim fidelity + evidence coverage.
  // narrativeHeuristicChecks are reported but do NOT alone define claimFidelity.
  // claimFidelity=true does NOT mean the whole free-text explanation is faithful.
  const pass =
    schemaOk &&
    report.inferred !== null &&
    refsAuthorized &&
    claimFidelity &&
    evidenceCoverage.ratio === 1 &&
    rubric.concise &&
    rubric.separatesHypothesis &&
    rubric.noMotivationFromName &&
    rubric.noImportAsBehavior &&
    rubric.noPathAsFailure;

  const out = {
    suite: 'agentic',
    status: pass ? 'passed' : 'failed',
    generatedAt: new Date().toISOString(),
    latencyMs: performance.now() - started,
    metrics: {
      jsonValid: schemaOk,
      claimFidelity,
      claimFidelityFailures: claimCheck.failures,
      narrativeHeuristicChecks: {
        ok: narrative.ok,
        findings: narrative.findings,
        note: 'Limited free-text signals; not a guarantee of narrative fidelity.',
      },
      evidenceCoverage,
      refsAuthorized,
      modelUsed: report.meta.modelUsed,
      inferredPresent: report.inferred !== null,
      claimCount: claims.length,
      unsupportedClaims: rubric.unsupportedClaims,
      rubric,
      note: 'claimFidelity=true certifies structured claims vs graph only, not the full LLM prose.',
    },
    report,
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(out, null, 2));
  console.log(`agentic eval ${out.status} → ${reportPath}`);
  console.log(
    `claimFidelity=${claimFidelity} evidenceCoverage=${evidenceCoverage.ratio} narrativeHeuristicOk=${narrative.ok}`,
  );
  return pass ? 0 : 1;
}

process.exitCode = await main();
