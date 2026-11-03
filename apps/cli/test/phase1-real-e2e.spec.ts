import { cp, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { IndexRepository, SnapshotQueryService } from '@corelive/core-engine';
import { EdgeType } from '@corelive/domain';
import { GraphifySourceIndexer } from '@corelive/source-graphify';
import { SqliteGraphRepository } from '@corelive/storage-sqlite';
import { describe, expect, it } from 'vitest';

const fixtureMiniRepo = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/source-graphify/test/fixtures/mini-repo',
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

describe('phase1 real e2e (Graphify → SQLite → query → evidence)', () => {
  it(
    'indexes mini-repo and answers all five queries with relative paths',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'corelive-p1-real-'));
      const dataDir = join(root, 'data');
      const repoDir = join(root, 'repo');
      await mkdir(dataDir, { recursive: true });
      await cp(fixtureMiniRepo, repoDir, { recursive: true });

      await git(repoDir, ['init']);
      await git(repoDir, ['add', '.']);
      await git(repoDir, ['commit', '-m', 'init']);

      const dbPath = join(dataDir, 'corelive.sqlite');
      const repo = new SqliteGraphRepository(dbPath);
      const indexRepository = new IndexRepository(
        new GraphifySourceIndexer(),
        repo,
      );
      const queries = new SnapshotQueryService(repo);

      try {
        const indexed = await indexRepository.index({ sourcePath: repoDir });
        expect(indexed.status).toBe('INDEXED');
        if (indexed.status !== 'INDEXED') {
          return;
        }

        const snap = await repo.getLatest();
        expect(snap).not.toBeNull();
        const methodNames = (snap?.nodes ?? [])
          .map((n) => n.name)
          .filter((n) => n.includes('reserve') || n.includes('create'));
        expect(methodNames.length).toBeGreaterThan(0);

        const who = await queries.whoCalls('.reserve()');
        expect(who.ok).toBe(true);
        if (who.ok) {
          expect(who.value.hits.some((h) => h.node.name === '.create()')).toBe(
            true,
          );
        }

        const dependents = await queries.dependents('.reserve()', {
          edgeTypes: [EdgeType.CALLS],
        });
        expect(dependents.ok).toBe(true);
        if (dependents.ok) {
          expect(dependents.value.hits.length).toBeGreaterThan(0);
        }

        const dependencies = await queries.dependencies('.create()');
        expect(dependencies.ok).toBe(true);
        if (dependencies.ok) {
          expect(
            dependencies.value.hits.some((h) => h.node.name === '.reserve()'),
          ).toBe(true);
        }

        const path = await queries.path('.create()', '.reserve()');
        expect(path.ok).toBe(true);
        if (path.ok) {
          expect(path.value.path.status).toBe('found');
          if (path.value.path.status === 'found') {
            expect(path.value.path.edges).toHaveLength(1);
          }
        }

        const evidence = await queries.evidence('.reserve()');
        expect(evidence.ok).toBe(true);
        if (evidence.ok) {
          expect(evidence.value.evidence.node.location.filePath).toMatch(
            /service\.ts$/,
          );
          expect(
            evidence.value.evidence.node.location.filePath.includes('..'),
          ).toBe(false);
          expect(evidence.value.evidence.nodeEvidence[0]?.origin).toBe('ast');
          expect(
            evidence.value.evidence.incidentEdges.some(
              (e) => e.edge.type === EdgeType.CALLS,
            ),
          ).toBe(true);
        }

        const again = await indexRepository.index({ sourcePath: repoDir });
        expect(again.status).toBe('UNCHANGED');
      } finally {
        repo.close();
        await rm(root, { recursive: true, force: true });
      }
    },
    180_000,
  );
});
