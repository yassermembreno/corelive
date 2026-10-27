import { createHash } from 'node:crypto';
import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { SourceIdentity } from '@corelive/domain';

import { IndexError } from '../errors/index-error.js';
import { computeContentFingerprint } from './content-fingerprint.js';
import { gitStdout } from './git-stdout.js';
import { normalizeRepositoryUri } from './normalize-repository-uri.js';
import {
  lookupOrAssignCatalogSourceId,
  resolveDefaultCatalogPath,
} from './source-catalog.js';

export interface ComputeSourceIdentityOptions {
  catalogPath?: string;
}

export async function computeSourceIdentity(
  sourcePath: string,
  options: ComputeSourceIdentityOptions = {},
): Promise<SourceIdentity> {
  const absolutePath = resolve(sourcePath);

  try {
    await access(absolutePath, constants.R_OK);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new IndexError(
        'SOURCE_NOT_FOUND',
        'identity',
        `Source path not found: ${absolutePath}`,
        { cause: error },
      );
    }
    throw new IndexError(
      'SOURCE_NOT_READABLE',
      'identity',
      `Source path is not readable: ${absolutePath}`,
      { cause: error },
    );
  }

  const repositoryUri = await readRepositoryUri(absolutePath);
  const commitSha = await readCommitSha(absolutePath);
  const dirty = await isDirty(absolutePath);
  const contentFingerprint = await computeContentFingerprint(absolutePath);
  const sourceId = await deriveSourceId(
    absolutePath,
    repositoryUri,
    options.catalogPath ?? resolveDefaultCatalogPath(),
  );

  return {
    sourceId,
    repositoryUri,
    commitSha,
    dirty,
    contentFingerprint,
  };
}

async function readRepositoryUri(
  repositoryRoot: string,
): Promise<string | undefined> {
  try {
    const raw = await gitStdout(repositoryRoot, [
      'remote',
      'get-url',
      'origin',
    ]);
    const normalized = normalizeRepositoryUri(raw.trim());
    return normalized || undefined;
  } catch {
    return undefined;
  }
}

async function readCommitSha(
  repositoryRoot: string,
): Promise<string | undefined> {
  try {
    const sha = await gitStdout(repositoryRoot, ['rev-parse', 'HEAD']);
    const trimmed = sha.trim();
    return trimmed || undefined;
  } catch {
    return undefined;
  }
}

async function isDirty(repositoryRoot: string): Promise<boolean> {
  try {
    const status = await gitStdout(repositoryRoot, ['status', '--porcelain']);
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

async function deriveSourceId(
  absolutePath: string,
  repositoryUri: string | undefined,
  catalogPath: string,
): Promise<string> {
  if (repositoryUri) {
    const hash = createHash('sha256')
      .update(repositoryUri, 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `src_${hash}`;
  }

  return lookupOrAssignCatalogSourceId(absolutePath, catalogPath);
}
