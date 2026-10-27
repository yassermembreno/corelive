import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { gitStdout } from './git-stdout.js';

/**
 * Content fingerprint for SourceIdentity.
 *
 * Formula (Phase 0):
 *   HEAD
 * + git diff HEAD --binary   (staged + unstaged tracked)
 * + content hashes of untracked files (sorted normalized paths)
 *
 * Does not mirror .graphifyignore. False SOURCE_CHANGED on unrelated
 * untracked files is acceptable in Phase 0.
 */
export async function computeContentFingerprint(
  repositoryRoot: string,
): Promise<string> {
  const head = await gitStdout(repositoryRoot, ['rev-parse', 'HEAD']).catch(
    () => 'NO_HEAD',
  );

  const diff = await gitStdout(repositoryRoot, [
    'diff',
    'HEAD',
    '--binary',
  ]).catch(() => '');

  const untrackedPaths = await listUntrackedFiles(repositoryRoot);
  const untrackedEntries: string[] = [];

  for (const filePath of untrackedPaths) {
    const absolute = join(repositoryRoot, filePath);
    const content = await readFile(absolute);
    const fileHash = createHash('sha256').update(content).digest('hex');
    untrackedEntries.push(`${normalizeRepoPath(filePath)}:${fileHash}`);
  }

  untrackedEntries.sort();

  const payload = [
    `head:${head.trim()}`,
    `diff:${hashText(diff)}`,
    `untracked:${untrackedEntries.join('|')}`,
  ].join('\n');

  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

async function listUntrackedFiles(repositoryRoot: string): Promise<string[]> {
  const output = await gitStdout(repositoryRoot, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
  ]).catch(() => '');

  if (!output) {
    return [];
  }

  return output
    .split('\0')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalizeRepoPath)
    .sort();
}

function normalizeRepoPath(filePath: string): string {
  return relative('.', filePath).split(sep).join('/');
}

function hashText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
