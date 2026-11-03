import { mkdir, mkdtemp, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  relativizeSourceFile,
  mapGraphifyNode,
  toGraphifyNodeId,
} from '../src/graphify/mapping/node-mapper.js';

const fixturesRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './fixtures',
);
const capturedDir = join(fixturesRoot, 'graphify-captured');
const miniRepo = join(fixturesRoot, 'mini-repo');

describe('relativizeSourceFile', () => {
  it('resolves Graphify relative paths against output dir into repo-relative paths', () => {
    const result = relativizeSourceFile('../mini-repo/src/controller.ts', {
      repositoryRoot: miniRepo,
      graphifyOutputDir: capturedDir,
    });
    expect(result).toBe('src/controller.ts');
  });

  it('relativizes absolute paths under the repository', () => {
    const abs = join(miniRepo, 'src', 'service.ts');
    expect(
      relativizeSourceFile(abs, {
        repositoryRoot: miniRepo,
        graphifyOutputDir: capturedDir,
      }),
    ).toBe('src/service.ts');
  });

  it('returns empty for paths outside the repository', () => {
    expect(
      relativizeSourceFile('/tmp/outside/file.ts', {
        repositoryRoot: miniRepo,
      }),
    ).toBe('');
  });

  it('rejects escaping relatives that never land inside the repo', () => {
    expect(
      relativizeSourceFile('../../../../etc/passwd', {
        repositoryRoot: miniRepo,
      }),
    ).toBe('');
  });

  it('accepts repo-relative paths when output-dir resolution misses', () => {
    expect(
      relativizeSourceFile('src/controller.ts', {
        repositoryRoot: miniRepo,
        graphifyOutputDir: capturedDir,
      }),
    ).toBe('src/controller.ts');
  });

  it('normalizes Windows-style separators for in-repo relatives without output dir', () => {
    expect(
      relativizeSourceFile('src\\controller.ts', {
        repositoryRoot: miniRepo,
      }),
    ).toBe('src/controller.ts');
  });

  it('preserves original metadata.sourceFile and NodeId', () => {
    const originalId =
      'users_yasse_rmembreno_dev_corelive_packages_parser_test_fixtures_mini_repo_src_controller_publiccontroller';
    const originalSource = '../mini-repo/src/controller.ts';
    const node = mapGraphifyNode(
      {
        id: originalId,
        label: 'PublicController',
        source_file: originalSource,
        source_location: 'L3',
        _origin: 'ast',
        file_type: 'code',
      },
      {
        repositoryRoot: miniRepo,
        graphifyOutputDir: capturedDir,
      },
    );

    expect(node.id).toBe(toGraphifyNodeId(originalId));
    expect(node.location.filePath).toBe('src/controller.ts');
    expect(node.metadata.sourceFile).toBe(originalSource);
  });

  it('treats symlink escape as out of bounds', async () => {
    if (platform() === 'win32') {
      return;
    }

    const root = await mkdtemp(join(tmpdir(), 'corelive-symlink-'));
    const repo = join(root, 'repo');
    const outside = join(root, 'outside');
    await mkdir(repo);
    await mkdir(outside);
    await writeFile(join(outside, 'secret.ts'), 'export {}\n');
    await symlink(outside, join(repo, 'link'));

    try {
      expect(
        relativizeSourceFile(join(repo, 'link', 'secret.ts'), {
          repositoryRoot: repo,
        }),
      ).toBe('');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
