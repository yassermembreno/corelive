import {
  runAnalysis,
  OllamaAdapter,
  consoleAnalysisLogger,
  type AnalysisReport,
} from '@corelive/analysis';
import { EdgeType } from '@corelive/domain';
import { SqliteGraphRepository } from '@corelive/storage-sqlite';

function parseEdgeTypes(raw: string | undefined): EdgeType[] | undefined {
  if (!raw) {
    return undefined;
  }
  const values = raw.split(',').map((v) => v.trim()).filter(Boolean);
  const valid = new Set(Object.values(EdgeType));
  for (const value of values) {
    if (!valid.has(value as EdgeType)) {
      throw new Error(
        `INVALID_EDGE_TYPE: ${value} (expected one of ${[...valid].join(', ')})`,
      );
    }
  }
  return values as EdgeType[];
}

function printHuman(report: AnalysisReport): void {
  console.log(`Operation: ${report.operation}`);
  console.log(`Snapshot: ${report.snapshotId}`);
  console.log(
    `Symbol: ${report.observed.node.name} (${report.observed.node.id}) ${report.observed.node.filePath}`,
  );
  console.log(`Type: ${report.observed.node.type}`);
  console.log(
    `Rationale: ${report.observed.rationale === null ? '(none)' : report.observed.rationale}`,
  );

  if (report.derived.explain) {
    console.log('Outgoing (by type):');
    for (const [type, reaches] of Object.entries(
      report.derived.explain.outgoingByType,
    )) {
      console.log(`  ${type}: ${reaches.length}`);
      for (const r of reaches) {
        console.log(`    - ${r.name} depth=${r.depth}`);
      }
    }
    console.log(`Callers (CALLS): ${report.derived.explain.callers.length}`);
    for (const r of report.derived.explain.callers) {
      console.log(`  - ${r.name} depth=${r.depth}`);
    }
  }

  if (report.derived.impact) {
    const { structuralConsumers, moduleBindings, references, truncated } =
      report.derived.impact;
    console.log(`Structural consumers (CALLS): ${structuralConsumers.length}`);
    for (const r of structuralConsumers) {
      console.log(`  - ${r.name} depth=${r.depth}`);
    }
    console.log(`Module bindings (IMPORTS): ${moduleBindings.length}`);
    for (const r of moduleBindings) {
      console.log(`  - ${r.name} depth=${r.depth}`);
    }
    console.log(`References: ${references.length}`);
    for (const r of references) {
      console.log(`  - ${r.name} depth=${r.depth}`);
    }
    console.log(`Truncated: ${truncated}`);
  }

  if (report.inferred) {
    console.log('Inferred (hypotheses):');
    for (const [key, value] of Object.entries(report.inferred)) {
      if (key === 'consequences' && Array.isArray(value)) {
        console.log(`  consequences: ${value.length}`);
        for (const item of value) {
          console.log(`    - ${item.text}`);
        }
      } else if (value && typeof value === 'object' && 'text' in value) {
        console.log(`  ${key}: ${value.text}`);
      } else {
        console.log(`  ${key}: (null)`);
      }
    }
  } else {
    console.log('Inferred: (none — deterministic mode or model unavailable)');
  }

  console.log('Limitations:');
  for (const limitation of report.limitations) {
    console.log(`  - [${limitation.code}] ${limitation.message}`);
  }
}

export type AnalysisCliOpts = {
  snapshot?: string;
  depth?: string;
  type?: string;
  json?: boolean;
  /**
   * Commander maps `--no-model` onto `model` (default true).
   * When false, skip the language model.
   */
  model?: boolean;
};

export async function runAnalysisCli(
  operation: 'explain' | 'impact',
  symbol: string,
  opts: AnalysisCliOpts,
  dbPath: string,
): Promise<number> {
  let edgeTypes: EdgeType[] | undefined;
  try {
    edgeTypes = parseEdgeTypes(opts.type);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const maxDepth = opts.depth !== undefined ? Number(opts.depth) : undefined;
  if (maxDepth !== undefined && (!Number.isInteger(maxDepth) || maxDepth < 0)) {
    console.error(`INVALID_DEPTH: ${opts.depth}`);
    return 1;
  }

  const noModel = opts.model === false;
  const repo = new SqliteGraphRepository(dbPath);
  try {
    const model = noModel ? null : new OllamaAdapter();
    const result = await runAnalysis(
      {
        operation,
        symbol,
        snapshotId: opts.snapshot,
        maxDepth,
        edgeTypes,
        noModel,
      },
      {
        graphRepository: repo,
        model,
        logger: consoleAnalysisLogger,
      },
    );

    if (!result.ok) {
      const error = result.error;
      if (error.code === 'SNAPSHOT_NOT_FOUND') {
        console.error(
          error.snapshotId
            ? `SNAPSHOT_NOT_FOUND: ${error.snapshotId}`
            : 'SNAPSHOT_NOT_FOUND: no snapshots in database',
        );
      } else if (error.code === 'SYMBOL_NOT_FOUND') {
        console.error(`SYMBOL_NOT_FOUND: ${error.symbol}`);
      } else if (error.code === 'SYMBOL_AMBIGUOUS') {
        console.error(`SYMBOL_AMBIGUOUS: ${error.symbol}`);
        for (const c of error.candidates) {
          const loc = c.location.filePath;
          const line =
            c.location.startLine != null ? `:${c.location.startLine}` : '';
          console.error(`  - ${c.name} (${c.id}) ${loc}${line}`);
        }
      } else if (error.code === 'INVALID_REQUEST') {
        console.error(`INVALID_REQUEST: ${error.message}`);
      } else {
        console.error(JSON.stringify(error));
      }
      return 1;
    }

    if (opts.json) {
      console.log(JSON.stringify(result.value, null, 2));
    } else {
      printHuman(result.value);
    }
    return 0;
  } finally {
    repo.close();
  }
}
