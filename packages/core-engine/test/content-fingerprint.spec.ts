import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { computeContentFingerprint } from '../src/source-identity/content-fingerprint.js';

async function git(cwd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
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
      else reject(new Error(`git ${args.join(' ')} failed: ${code}`));
    });
  });
}

describe('computeContentFingerprint', () => {
  it('changes when an untracked file content changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'corelive-fp-'));

    try {
      await git(root, ['init']);
      await writeFile(join(root, 'tracked.ts'), 'export const a = 1;\n');
      await git(root, ['add', 'tracked.ts']);
      await git(root, ['commit', '-m', 'init']);

      await writeFile(join(root, 'new.ts'), 'export const x = 1;\n');
      const first = await computeContentFingerprint(root);

      await writeFile(join(root, 'new.ts'), 'export const x = 2;\n');
      const second = await computeContentFingerprint(root);

      expect(first).not.toBe(second);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('changes when a tracked file is modified', async () => {
    const root = await mkdtemp(join(tmpdir(), 'corelive-fp-'));

    try {
      await git(root, ['init']);
      await mkdir(join(root, 'src'), { recursive: true });
      await writeFile(join(root, 'src/a.ts'), 'export const a = 1;\n');
      await git(root, ['add', '.']);
      await git(root, ['commit', '-m', 'init']);

      const clean = await computeContentFingerprint(root);

      await writeFile(join(root, 'src/a.ts'), 'export const a = 2;\n');
      const dirty = await computeContentFingerprint(root);

      expect(clean).not.toBe(dirty);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('is stable for an unchanged clean tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'corelive-fp-'));

    try {
      await git(root, ['init']);
      await writeFile(join(root, 'a.ts'), 'export const a = 1;\n');
      await git(root, ['add', '.']);
      await git(root, ['commit', '-m', 'init']);

      const a = await computeContentFingerprint(root);
      const b = await computeContentFingerprint(root);

      expect(a).toBe(b);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
