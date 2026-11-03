import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { err, ok } from '@corelive/core-engine';
import { describe, expect, it } from 'vitest';

import { GraphifySourceIndexer } from '../src/graphify/graphify-source-indexer.js';
import type { GraphifyRunner } from '../src/graphify/runner/graphify-runner.js';

const capturedGraph = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './fixtures/graphify-captured/graph.json',
);

async function git(cwd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: 'ignore',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'CoreLive',
        GIT_AUTHOR_EMAIL: 'test@corelive.local',
        GIT_COMMITTER_NAME: 'CoreLive',
        GIT_COMMITTER_EMAIL: 'test@corelive.local',
      },
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`git failed: ${args.join(' ')}`));
    });
  });
}

async function makeMiniRepo(): Promise<string> {
  const repoDir = await mkdtemp(join(tmpdir(), 'corelive-idx-repo-'));
  await mkdir(join(repoDir, 'src'), { recursive: true });
  await writeFile(join(repoDir, 'src/a.ts'), 'export const a = 1;\n');
  await writeFile(
    join(repoDir, 'package.json'),
    JSON.stringify({ name: 'idx-mini', type: 'module' }),
  );
  await git(repoDir, ['init']);
  await git(repoDir, ['add', '.']);
  await git(repoDir, ['commit', '-m', 'init']);
  return repoDir;
}

async function expectMissing(path: string): Promise<void> {
  await expect(access(path)).rejects.toThrow();
}

describe('GraphifySourceIndexer temp cleanup', () => {
  it('removes output dir after successful index', async () => {
    const repoDir = await makeMiniRepo();
    let outputDirectory = '';

    const runner: GraphifyRunner = {
      execute: (request) => {
        outputDirectory = request.outputDirectory;
        return Promise.resolve(
          ok({
            toolVersion: '0.9.16',
            outputDirectory: request.outputDirectory,
            durationMs: 1,
            exitCode: 0,
            graphJsonPath: capturedGraph,
          }),
        );
      },
    };

    const indexer = new GraphifySourceIndexer(runner);
    await indexer.index({ sourcePath: repoDir });
    expect(outputDirectory).not.toBe('');
    await expectMissing(outputDirectory);
  });

  it('removes output dir after extraction failure', async () => {
    const repoDir = await makeMiniRepo();
    let outputDirectory = '';

    const runner: GraphifyRunner = {
      execute: (request) => {
        outputDirectory = request.outputDirectory;
        return Promise.resolve(err('EXTRACTION_FAILED'));
      },
    };

    const indexer = new GraphifySourceIndexer(runner);
    await expect(indexer.index({ sourcePath: repoDir })).rejects.toThrow(
      /EXTRACTION_FAILED/,
    );
    await expectMissing(outputDirectory);
  });

  it('removes output dir after CANCELLED extraction', async () => {
    const repoDir = await makeMiniRepo();
    let outputDirectory = '';

    const runner: GraphifyRunner = {
      execute: (request) => {
        outputDirectory = request.outputDirectory;
        return Promise.resolve(err('CANCELLED'));
      },
    };

    const indexer = new GraphifySourceIndexer(runner);
    await expect(indexer.index({ sourcePath: repoDir })).rejects.toThrow(
      /CANCELLED/,
    );
    await expectMissing(outputDirectory);
  });
});
