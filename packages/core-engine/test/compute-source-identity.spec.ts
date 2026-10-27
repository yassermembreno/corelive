import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { computeSourceIdentity } from '../src/source-identity/compute-source-identity.js';
import { normalizeRepositoryUri } from '../src/source-identity/normalize-repository-uri.js';

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

describe('computeSourceIdentity', () => {
  it('derives stable sourceId from origin remote on a git repo', async () => {
    const root = await mkdtemp(join(tmpdir(), 'corelive-identity-'));
    const catalogPath = join(root, 'catalog.json');

    try {
      await git(root, ['init']);
      await git(root, [
        'remote',
        'add',
        'origin',
        'https://github.com/corelive/example.git',
      ]);
      await writeFile(join(root, 'a.ts'), 'export const a = 1;\n');
      await git(root, ['add', '.']);
      await git(root, ['commit', '-m', 'init']);

      const identity = await computeSourceIdentity(root, { catalogPath });
      const normalized = normalizeRepositoryUri(
        'https://github.com/corelive/example.git',
      );
      const expectedSourceId = `src_${createHash('sha256')
        .update(normalized, 'utf8')
        .digest('hex')
        .slice(0, 16)}`;

      expect(identity.sourceId).toBe(expectedSourceId);
      expect(identity.repositoryUri).toBe(normalized);
      expect(identity.commitSha).toMatch(/^[0-9a-f]{40}$/);
      expect(identity.dirty).toBe(false);
      expect(identity.contentFingerprint).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('marks dirty when the working tree has changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'corelive-identity-'));
    const catalogPath = join(root, 'catalog.json');

    try {
      await git(root, ['init']);
      await writeFile(join(root, 'a.ts'), 'export const a = 1;\n');
      await git(root, ['add', '.']);
      await git(root, ['commit', '-m', 'init']);

      const clean = await computeSourceIdentity(root, { catalogPath });

      await writeFile(join(root, 'a.ts'), 'export const a = 2;\n');
      const dirty = await computeSourceIdentity(root, { catalogPath });

      expect(clean.dirty).toBe(false);
      expect(dirty.dirty).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('assigns a catalog sourceId when no origin remote exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'corelive-identity-'));
    const catalogPath = join(root, 'catalog.json');

    try {
      await git(root, ['init']);
      await writeFile(join(root, 'a.ts'), 'export const a = 1;\n');
      await git(root, ['add', '.']);
      await git(root, ['commit', '-m', 'init']);

      const first = await computeSourceIdentity(root, { catalogPath });
      const second = await computeSourceIdentity(root, { catalogPath });

      expect(first.repositoryUri).toBeUndefined();
      expect(first.sourceId).toMatch(/^src_[0-9a-f]{32}$/);
      expect(second.sourceId).toBe(first.sourceId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
