import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { Command } from 'commander';
import {
  IndexRepository,
  SnapshotQueryService,
  type QueryError,
} from '@corelive/core-engine';
import { EdgeType, type Evidence, type GraphNode } from '@corelive/domain';
import {
  GRAPHIFYY_PACKAGE,
  GRAPHIFYY_PIN,
  GraphifySourceIndexer,
  assertCompatibleGraphifyVersion,
} from '@corelive/source-graphify';
import { SqliteGraphRepository } from '@corelive/storage-sqlite';

function resolveDataDir(): string {
  return (
    process.env.CORELIVE_DATA_DIR?.trim() ||
    join(homedir(), '.corelive')
  );
}

function resolveDbPath(): string {
  return join(resolveDataDir(), 'corelive.sqlite');
}

async function runCommand(
  command: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString('utf8');
    });
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function which(bin: string): Promise<string | null> {
  const result = await runCommand(process.platform === 'win32' ? 'where' : 'which', [
    bin,
  ]).catch(() => null);
  if (!result || result.code !== 0) {
    return null;
  }
  return result.stdout.trim().split('\n')[0] ?? null;
}

async function doctor(): Promise<number> {
  const uvPath = await which('uv');
  const graphifyPath = await which(process.env.GRAPHIFY_BIN?.trim() || 'graphify');

  console.log('CoreLive doctor');
  console.log(`  uv: ${uvPath ?? 'NOT FOUND'}`);
  console.log(`  graphify: ${graphifyPath ?? 'NOT FOUND'}`);
  console.log(`  required pin: ${GRAPHIFYY_PACKAGE}==${GRAPHIFYY_PIN}`);

  if (!uvPath) {
    console.error('  FAIL: install uv (https://docs.astral.sh/uv/) then run `corelive setup`');
    return 1;
  }

  if (!graphifyPath) {
    console.error('  FAIL: graphify not on PATH — run `corelive setup`');
    return 1;
  }

  const version = await runCommand(graphifyPath, ['--version']);
  const versionText = (version.stdout || version.stderr).trim();
  console.log(`  graphify --version: ${versionText || '(empty)'}`);

  if (!assertCompatibleGraphifyVersion(versionText)) {
    console.error(
      `  FAIL: incompatible version (want ${GRAPHIFYY_PIN}). Run \`corelive setup\`.`,
    );
    return 1;
  }

  console.log('  Status: compatible');
  return 0;
}

async function setup(): Promise<number> {
  const uvPath = await which('uv');
  if (!uvPath) {
    console.error('uv not found. Install uv first: https://docs.astral.sh/uv/');
    return 1;
  }

  console.log(`Installing ${GRAPHIFYY_PACKAGE}==${GRAPHIFYY_PIN} via uv tool...`);
  const result = await runCommand(uvPath, [
    'tool',
    'install',
    `${GRAPHIFYY_PACKAGE}==${GRAPHIFYY_PIN}`,
    '--force',
  ]);

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.code !== 0) {
    console.error('setup failed');
    return result.code;
  }

  console.log('Done. Run `corelive doctor` to verify.');
  return 0;
}

async function indexRepository(sourcePath: string): Promise<number> {
  const abs = resolve(sourcePath);
  const dataDir = resolveDataDir();
  mkdirSync(dataDir, { recursive: true });

  const dbPath = resolveDbPath();
  const repo = new SqliteGraphRepository(dbPath);
  const indexer = new GraphifySourceIndexer();
  const indexRepository = new IndexRepository(indexer, repo);

  try {
    console.log(`Indexing ${abs}`);
    console.log(`Database: ${dbPath}`);

    const outcome = await indexRepository.index({ sourcePath: abs });

    if (outcome.status === 'INDEXED') {
      console.log(`Status: INDEXED`);
      console.log(`Snapshot: ${outcome.snapshotId}`);
      if (outcome.warnings.length > 0) {
        console.log(`Warnings: ${outcome.warnings.length}`);
        for (const warning of outcome.warnings) {
          console.log(`  - [${warning.code}] ${warning.message}`);
        }
      }
      return 0;
    }

    if (outcome.status === 'UNCHANGED') {
      console.log(`Status: UNCHANGED`);
      console.log(`Snapshot: ${outcome.snapshotId}`);
      return 0;
    }

    console.error(`Status: FAILED`);
    console.error(`Stage: ${outcome.stage}`);
    console.error(`Failure: ${outcome.failure}`);
    if (outcome.message) {
      console.error(`Message: ${outcome.message}`);
    }
    return 1;
  } finally {
    repo.close();
  }
}

function formatLocation(node: GraphNode): string {
  const { filePath, startLine, endLine } = node.location;
  if (startLine != null && endLine != null && startLine !== endLine) {
    return `${filePath}:${startLine}-${endLine}`;
  }
  if (startLine != null) {
    return `${filePath}:${startLine}`;
  }
  return filePath;
}

function formatEvidenceBrief(evidence: Evidence[]): string {
  if (evidence.length === 0) {
    return '(none)';
  }
  return evidence
    .map((e) => {
      const loc = e.location ? ` ${e.location}` : '';
      const file = e.filePath ? ` ${e.filePath}` : '';
      return `${e.origin}${file}${loc}`.trim();
    })
    .join('; ');
}

function printQueryError(error: QueryError): void {
  switch (error.code) {
    case 'SNAPSHOT_NOT_FOUND':
      console.error(
        error.snapshotId
          ? `SNAPSHOT_NOT_FOUND: ${error.snapshotId}`
          : 'SNAPSHOT_NOT_FOUND: no snapshots in database',
      );
      break;
    case 'SYMBOL_NOT_FOUND':
      console.error(`SYMBOL_NOT_FOUND: ${error.symbol}`);
      break;
    case 'SYMBOL_AMBIGUOUS':
      console.error(`SYMBOL_AMBIGUOUS: ${error.symbol}`);
      for (const c of error.candidates) {
        const loc = c.location.filePath;
        const line =
          c.location.startLine != null ? `:${c.location.startLine}` : '';
        console.error(`  - ${c.name} (${c.id}) ${loc}${line}`);
      }
      break;
  }
}

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

type QuerySharedOpts = {
  snapshot?: string;
  type?: string;
};

async function withQueryService<T>(
  run: (service: SnapshotQueryService) => Promise<T>,
): Promise<T> {
  const repo = new SqliteGraphRepository(resolveDbPath());
  try {
    return await run(new SnapshotQueryService(repo));
  } finally {
    repo.close();
  }
}

async function runWhoCalls(symbol: string, opts: QuerySharedOpts): Promise<number> {
  return withQueryService(async (service) => {
    const result = await service.whoCalls(symbol, {
      snapshotId: opts.snapshot,
    });
    if (!result.ok) {
      printQueryError(result.error);
      return 1;
    }
    console.log(`Snapshot: ${result.value.snapshotId}`);
    console.log(`Symbol: ${result.value.symbol.name} (${result.value.symbol.id})`);
    console.log(`Callers: ${result.value.hits.length}`);
    for (const hit of result.value.hits) {
      console.log(
        `  - ${hit.node.name} (${hit.node.id}) ${formatLocation(hit.node)} [${hit.edge.type}] evidence=${formatEvidenceBrief(hit.edge.evidence)}`,
      );
    }
    return 0;
  });
}

async function runDependents(symbol: string, opts: QuerySharedOpts): Promise<number> {
  let edgeTypes: EdgeType[] | undefined;
  try {
    edgeTypes = parseEdgeTypes(opts.type);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  return withQueryService(async (service) => {
    const result = await service.dependents(symbol, {
      snapshotId: opts.snapshot,
      edgeTypes,
    });
    if (!result.ok) {
      printQueryError(result.error);
      return 1;
    }
    console.log(`Snapshot: ${result.value.snapshotId}`);
    console.log(`Symbol: ${result.value.symbol.name} (${result.value.symbol.id})`);
    console.log(`Dependents: ${result.value.hits.length}`);
    for (const hit of result.value.hits) {
      console.log(
        `  - ${hit.node.name} (${hit.node.id}) ${formatLocation(hit.node)} [${hit.edge.type}]`,
      );
    }
    return 0;
  });
}

async function runDependencies(symbol: string, opts: QuerySharedOpts): Promise<number> {
  let edgeTypes: EdgeType[] | undefined;
  try {
    edgeTypes = parseEdgeTypes(opts.type);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  return withQueryService(async (service) => {
    const result = await service.dependencies(symbol, {
      snapshotId: opts.snapshot,
      edgeTypes,
    });
    if (!result.ok) {
      printQueryError(result.error);
      return 1;
    }
    console.log(`Snapshot: ${result.value.snapshotId}`);
    console.log(`Symbol: ${result.value.symbol.name} (${result.value.symbol.id})`);
    console.log(`Dependencies: ${result.value.hits.length}`);
    for (const hit of result.value.hits) {
      console.log(
        `  - ${hit.node.name} (${hit.node.id}) ${formatLocation(hit.node)} [${hit.edge.type}]`,
      );
    }
    return 0;
  });
}

async function runPath(from: string, to: string, opts: QuerySharedOpts): Promise<number> {
  return withQueryService(async (service) => {
    const result = await service.path(from, to, {
      snapshotId: opts.snapshot,
    });
    if (!result.ok) {
      printQueryError(result.error);
      return 1;
    }

    console.log(`Snapshot: ${result.value.snapshotId}`);
    console.log(
      `From: ${result.value.from.name} (${result.value.from.id})`,
    );
    console.log(`To: ${result.value.to.name} (${result.value.to.id})`);

    if (result.value.path.status === 'no_path') {
      console.error(`NO_PATH: ${result.value.path.reason}`);
      return 2;
    }

    console.log(`Path length: ${result.value.path.edges.length}`);
    for (let i = 0; i < result.value.path.nodes.length; i += 1) {
      const node = result.value.path.nodes[i]!;
      const edge = result.value.path.edges[i];
      if (edge) {
        console.log(
          `  ${node.name} (${node.id}) -[${edge.type}]->`,
        );
      } else {
        console.log(`  ${node.name} (${node.id})`);
      }
    }
    return 0;
  });
}

async function runEvidence(symbol: string, opts: QuerySharedOpts): Promise<number> {
  return withQueryService(async (service) => {
    const result = await service.evidence(symbol, {
      snapshotId: opts.snapshot,
    });
    if (!result.ok) {
      printQueryError(result.error);
      return 1;
    }

    const { evidence, snapshotId } = result.value;
    console.log(`Snapshot: ${snapshotId}`);
    console.log(
      `Symbol: ${evidence.node.name} (${evidence.node.id}) ${formatLocation(evidence.node)}`,
    );
    console.log(`Node evidence: ${evidence.nodeEvidence.length}`);
    for (const e of evidence.nodeEvidence) {
      console.log(`  - ${formatEvidenceBrief([e])}`);
    }
    console.log(`Incident edges: ${evidence.incidentEdges.length}`);
    for (const item of evidence.incidentEdges) {
      console.log(
        `  - [${item.edge.type}] ${item.edge.source} → ${item.edge.target} evidence=${formatEvidenceBrief(item.evidence)}`,
      );
    }
    return 0;
  });
}

const program = new Command();

program
  .name('corelive')
  .description('CoreLive — Graphify-native software knowledge model')
  .version('0.0.1');

program
  .command('doctor')
  .description('Verify uv and pinned graphifyy are available')
  .action(async () => {
    process.exitCode = await doctor();
  });

program
  .command('setup')
  .description(`Install pinned ${GRAPHIFYY_PACKAGE}==${GRAPHIFYY_PIN}`)
  .action(async () => {
    process.exitCode = await setup();
  });

program
  .command('index')
  .description('Index a repository with Graphify and persist a KnowledgeSnapshot')
  .argument('<repository>', 'Path to the repository')
  .action(async (repository: string) => {
    process.exitCode = await indexRepository(repository);
  });

const query = program
  .command('query')
  .description(
    'Query a persisted KnowledgeSnapshot (Graphify names: PublicController, .reserve())',
  );

query
  .command('who-calls')
  .description('Incoming CALLS edges (who calls the symbol)')
  .argument('<symbol>', 'Node id or exact Graphify name')
  .option('--snapshot <id>', 'Snapshot id (default: latest)')
  .action(async (symbol: string, opts: QuerySharedOpts) => {
    process.exitCode = await runWhoCalls(symbol, opts);
  });

query
  .command('dependents')
  .description('Incoming edges (optionally filtered by --type)')
  .argument('<symbol>', 'Node id or exact Graphify name')
  .option('--snapshot <id>', 'Snapshot id (default: latest)')
  .option('--type <EdgeType>', 'Comma-separated EdgeType filter')
  .action(async (symbol: string, opts: QuerySharedOpts) => {
    process.exitCode = await runDependents(symbol, opts);
  });

query
  .command('dependencies')
  .description('Outgoing edges (optionally filtered by --type)')
  .argument('<symbol>', 'Node id or exact Graphify name')
  .option('--snapshot <id>', 'Snapshot id (default: latest)')
  .option('--type <EdgeType>', 'Comma-separated EdgeType filter')
  .action(async (symbol: string, opts: QuerySharedOpts) => {
    process.exitCode = await runDependencies(symbol, opts);
  });

query
  .command('path')
  .description('Shortest directed path (BFS); exit 2 if NO_PATH')
  .argument('<from>', 'Source symbol')
  .argument('<to>', 'Target symbol')
  .option('--snapshot <id>', 'Snapshot id (default: latest)')
  .action(async (from: string, to: string, opts: QuerySharedOpts) => {
    process.exitCode = await runPath(from, to, opts);
  });

query
  .command('evidence')
  .description('Original node location and incident edge evidence')
  .argument('<symbol>', 'Node id or exact Graphify name')
  .option('--snapshot <id>', 'Snapshot id (default: latest)')
  .action(async (symbol: string, opts: QuerySharedOpts) => {
    process.exitCode = await runEvidence(symbol, opts);
  });

await program.parseAsync(process.argv);
