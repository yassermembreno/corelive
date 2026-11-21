import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chmodSync } from 'node:fs';

import {
  EdgeType,
  GraphSource,
  NodeType,
  type KnowledgeSnapshot,
} from '@corelive/domain';
import { SqliteGraphRepository } from '@corelive/storage-sqlite';
import { describe, expect, it } from 'vitest';

const binPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../bin/corelive.mjs',
);

function seedSnapshot(): KnowledgeSnapshot {
  return {
    id: 'snap_dx',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    identity: {
      sourceId: 'src_dx',
      dirty: false,
      contentFingerprint: 'fp_dx',
    },
    source: GraphSource.GRAPHIFY,
    nodes: [
      {
        id: 'n_create',
        name: '.create()',
        type: NodeType.METHOD,
        metadata: {},
        location: { filePath: 'controller.ts', startLine: 6 },
        evidence: [],
      },
      {
        id: 'n_reserve',
        name: '.reserve()',
        type: NodeType.METHOD,
        metadata: {},
        location: { filePath: 'service.ts', startLine: 2 },
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
        evidence: [],
      },
    ],
  };
}

async function runBin(
  dataDir: string,
  args: string[],
  initCwd?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [binPath, ...args], {
      env: {
        ...process.env,
        CORELIVE_DATA_DIR: dataDir,
        ...(initCwd ? { INIT_CWD: initCwd } : {}),
      },
      cwd: initCwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
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

describe('DX CLI bin wrapper', () => {
  it('runs query who-calls reserve via bin/corelive.mjs', async () => {
    chmodSync(binPath, 0o755);
    const root = await mkdtemp(join(tmpdir(), 'corelive-dx-'));
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

      const who = await runBin(dataDir, ['query', 'who-calls', 'reserve']);
      expect(who.code).toBe(0);
      expect(who.stdout).toContain('.create()');
      expect(who.stderr).not.toContain('Failed to start corelive');

      const dependents = await runBin(dataDir, [
        '--',
        'query',
        'dependents',
        'reserve',
        '--type',
        'CALLS',
      ]);
      expect(dependents.code).toBe(0);
      expect(dependents.stdout).toContain('.create()');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
