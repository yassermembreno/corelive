import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import {
  EdgeType,
  GraphSource,
  NodeType,
  type KnowledgeSnapshot,
} from '@corelive/domain';
import { SqliteGraphRepository } from '@corelive/storage-sqlite';
import { describe, expect, it } from 'vitest';

const cliPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/cli.ts',
);

function seedSnapshot(): KnowledgeSnapshot {
  return {
    id: 'snap_cli',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    identity: {
      sourceId: 'src_cli',
      dirty: false,
      contentFingerprint: 'fp_cli',
    },
    source: GraphSource.GRAPHIFY,
    nodes: [
      {
        id: 'n_create',
        name: '.create()',
        type: NodeType.METHOD,
        metadata: {},
        location: { filePath: 'controller.ts', startLine: 6 },
        evidence: [
          {
            id: 'ev_create',
            source: 'graphify',
            origin: 'ast',
            filePath: 'controller.ts',
            location: 'L6',
          },
        ],
      },
      {
        id: 'n_reserve',
        name: '.reserve()',
        type: NodeType.METHOD,
        metadata: {},
        location: { filePath: 'service.ts', startLine: 2 },
        evidence: [
          {
            id: 'ev_reserve',
            source: 'graphify',
            origin: 'ast',
            filePath: 'service.ts',
            location: 'L2',
          },
        ],
      },
      {
        id: 'n_orphan',
        name: 'Orphan',
        type: NodeType.CLASS,
        metadata: {},
        location: { filePath: 'orphan.ts', startLine: 1 },
        evidence: [],
      },
    ],
    edges: [
      {
        id: 'e_calls',
        type: EdgeType.CALLS,
        source: 'n_create',
        target: 'n_reserve',
        metadata: {},
        evidence: [
          {
            id: 'ev_edge',
            source: 'graphify',
            origin: 'ast',
            filePath: 'controller.ts',
            location: 'L7',
          },
        ],
      },
    ],
  };
}

async function runCli(
  dataDir: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', cliPath, ...args],
      {
        env: {
          ...process.env,
          CORELIVE_DATA_DIR: dataDir,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
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

describe('phase1 query CLI e2e', () => {
  it('runs the five query subcommands against a seeded snapshot', async () => {
    const root = await mkdtemp(join(tmpdir(), 'corelive-p1-'));
    const dataDir = join(root, 'data');
    const repo = new SqliteGraphRepository(join(dataDir, 'corelive.sqlite'));

    try {
      await repo.save(seedSnapshot(), {
        extractor: 'graphify',
        extractorVersion: '0.9.16',
        canonicalSchemaVersion: '1',
        durationMs: 1,
      });
      repo.close();

      const who = await runCli(dataDir, ['query', 'who-calls', '.reserve()']);
      expect(who.code).toBe(0);
      expect(who.stdout).toContain('.create()');

      const dependents = await runCli(dataDir, [
        'query',
        'dependents',
        '.reserve()',
        '--type',
        'CALLS',
      ]);
      expect(dependents.code).toBe(0);
      expect(dependents.stdout).toContain('.create()');

      const dependencies = await runCli(dataDir, [
        'query',
        'dependencies',
        '.create()',
      ]);
      expect(dependencies.code).toBe(0);
      expect(dependencies.stdout).toContain('.reserve()');

      const pathOk = await runCli(dataDir, [
        'query',
        'path',
        '.create()',
        '.reserve()',
      ]);
      expect(pathOk.code).toBe(0);
      expect(pathOk.stdout).toContain('Path length:');

      const pathMissing = await runCli(dataDir, [
        'query',
        'path',
        '.create()',
        'Orphan',
      ]);
      expect(pathMissing.code).toBe(2);
      expect(pathMissing.stderr).toContain('NO_PATH');

      const evidence = await runCli(dataDir, [
        'query',
        'evidence',
        '.reserve()',
        '--snapshot',
        'snap_cli',
      ]);
      expect(evidence.code).toBe(0);
      expect(evidence.stdout).toContain('Node evidence:');
      expect(evidence.stdout).toContain('service.ts');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
