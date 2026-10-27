import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { Command } from 'commander';
import { IndexRepository } from '@corelive/core-engine';
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

await program.parseAsync(process.argv);
