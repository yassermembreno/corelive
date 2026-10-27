import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { IndexRepository } from '@corelive/core-engine';
import { GraphifySourceIndexer } from '@corelive/source-graphify';
import { SqliteGraphRepository } from '@corelive/storage-sqlite';
import { describe, expect, it } from 'vitest';

async function git(cwd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
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
      if (code === 0) resolve();
      else reject(new Error(`git failed: ${args.join(' ')}`));
    });
  });
}

describe('phase0 e2e (graphify binary)', () => {
  it(
    'indexes a tiny repo end-to-end and reuses snapshot on second run',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'corelive-e2e-'));
      const dataDir = join(root, 'data');
      const repoDir = join(root, 'repo');
      await mkdir(join(repoDir, 'src'), { recursive: true });
      await mkdir(dataDir, { recursive: true });

      await writeFile(
        join(repoDir, 'src/service.ts'),
        'export class HelloService { greet() { return "hi"; } }\n',
      );
      await writeFile(
        join(repoDir, 'src/app.ts'),
        `import { HelloService } from './service.js';\nconst s = new HelloService();\ns.greet();\n`,
      );
      await writeFile(
        join(repoDir, 'package.json'),
        JSON.stringify({ name: 'e2e-mini', type: 'module' }),
      );

      await git(repoDir, ['init']);
      await git(repoDir, ['add', '.']);
      await git(repoDir, ['commit', '-m', 'init']);

      const dbPath = join(dataDir, 'corelive.sqlite');
      const repo = new SqliteGraphRepository(dbPath);
      const indexRepository = new IndexRepository(
        new GraphifySourceIndexer(),
        repo,
      );

      try {
        const first = await indexRepository.index({ sourcePath: repoDir });
        expect(first.status).toBe('INDEXED');
        if (first.status === 'INDEXED') {
          expect(first.snapshotId.startsWith('snap_')).toBe(true);
        }

        const second = await indexRepository.index({ sourcePath: repoDir });
        expect(second.status).toBe('UNCHANGED');
        if (first.status === 'INDEXED' && second.status === 'UNCHANGED') {
          expect(second.snapshotId).toBe(first.snapshotId);
        }
      } finally {
        repo.close();
        await rm(root, { recursive: true, force: true });
      }
    },
    120_000,
  );
});
