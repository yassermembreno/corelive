import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { argvForCommander } from '../src/argv-for-commander.js';

const cliRoot = fileURLToPath(new URL('..', import.meta.url));
const monorepoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const miniRepo = join(
  monorepoRoot,
  'packages/source-graphify/test/fixtures/mini-repo',
);

async function runCli(
  args: string[],
  env: Record<string, string | undefined>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', join(cliRoot, 'src/cli.ts'), ...args],
      {
        cwd: cliRoot,
        env: { ...process.env, ...env },
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
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

describe('phase2 analysis CLI', () => {
  it('indexes mini-repo and explains/impacts with --no-model --json', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'corelive-phase2-'));
    try {
      const index = await runCli(['index', miniRepo], {
        CORELIVE_DATA_DIR: dataDir,
      });
      expect(index.code).toBe(0);

      const explain = await runCli(
        ['explain', '.reserve()', '--no-model', '--json'],
        { CORELIVE_DATA_DIR: dataDir },
      );
      expect(explain.code).toBe(0);
      const explainReport = JSON.parse(explain.stdout);
      expect(explainReport.operation).toBe('explain');
      expect(explainReport.observed.node.name).toBe('.reserve()');
      expect(explainReport.observed.rationale).toBeNull();
      expect(explainReport.inferred).toBeNull();
      expect(explainReport.derived.explain.callers.length).toBeGreaterThan(0);

      const impact = await runCli(
        ['analyze', 'impact', '.reserve()', '--no-model', '--json', '--depth', '3'],
        { CORELIVE_DATA_DIR: dataDir },
      );
      expect(impact.code).toBe(0);
      const impactReport = JSON.parse(impact.stdout);
      expect(impactReport.operation).toBe('impact');
      expect(impactReport.derived.impact.structuralConsumers.length).toBeGreaterThan(
        0,
      );
      expect(
        impactReport.limitations.some(
          (l: { code: string }) => l.code === 'CONTAINS_EXCLUDED',
        ),
      ).toBe(true);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 120_000);

  it('strips pnpm -- before analysis flags', () => {
    const argv = argvForCommander([
      'node',
      'cli.ts',
      '--',
      'explain',
      'x',
      '--no-model',
      '--json',
    ]);
    expect(argv).toEqual([
      'node',
      'cli.ts',
      'explain',
      'x',
      '--no-model',
      '--json',
    ]);
  });
});
