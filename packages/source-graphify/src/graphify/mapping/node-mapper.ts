import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { createEvidenceId } from '@corelive/core-engine';
import { NodeType, type GraphNode } from '@corelive/domain';

import type { NodeMapper } from '../../contracts/node-mapper.js';
import type { GraphifyNode } from '../graphify-node.js';
import type { GraphifyNodeMetadata } from './graphify-node-metadata.js';

const CODE_FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.swift',
  '.kt',
  '.scala',
] as const;

const GRAPHIFY_NODE_ID_PREFIX = 'graphify:' as const;

export function toGraphifyNodeId(originalId: string): string {
  return `${GRAPHIFY_NODE_ID_PREFIX}${originalId}`;
}

function endsWithCodeExtension(value: string): boolean {
  const lower = value.toLowerCase();
  return CODE_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function inferNodeType(node: GraphifyNode): NodeType {
  const label = node.label;

  if (endsWithCodeExtension(label)) {
    return NodeType.FILE;
  }

  if (label.startsWith('.') && label.endsWith('()')) {
    return NodeType.METHOD;
  }

  if (label.endsWith('()')) {
    return NodeType.FUNCTION;
  }

  if (/^[A-Z][a-zA-Z0-9]*$/.test(label)) {
    return NodeType.CLASS;
  }

  return NodeType.UNKNOWN;
}

function parseStartLine(sourceLocation?: string): number | undefined {
  if (!sourceLocation) {
    return undefined;
  }

  const match = /^L(\d+)(?:-L(\d+))?$/.exec(sourceLocation.trim());
  if (!match) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
}

function parseEndLine(sourceLocation?: string): number | undefined {
  if (!sourceLocation) {
    return undefined;
  }

  const match = /^L(\d+)(?:-L(\d+))?$/.exec(sourceLocation.trim());
  if (!match?.[2]) {
    return undefined;
  }

  return Number.parseInt(match[2], 10);
}

export type RelativizeSourceFileOptions = {
  repositoryRoot?: string;
  /**
   * Base directory for Graphify relative `source_file` paths.
   * Live extract: the `--out` directory (parent of `graphify-out/`).
   * Captured fixtures: directory containing `graph.json`.
   */
  graphifyOutputDir?: string;
};

function toPosix(pathValue: string): string {
  return pathValue.replace(/\\/g, '/');
}

function tryRealpath(pathValue: string): string {
  try {
    if (existsSync(pathValue)) {
      return realpathSync(pathValue);
    }
  } catch {
    // Fall through to resolve().
  }
  return resolve(pathValue);
}

/** True when candidate is the root or a path inside it (POSIX + Windows drives). */
export function isPathInsideRoot(root: string, candidate: string): boolean {
  const rootReal = tryRealpath(root);
  const candidateReal = tryRealpath(candidate);
  const rel = relative(rootReal, candidateReal);
  if (rel === '') {
    return true;
  }
  if (isAbsolute(rel)) {
    return false;
  }
  const posix = toPosix(rel);
  return posix !== '..' && !posix.startsWith('../');
}

/**
 * Normalize Graphify `source_file` for location/evidence.
 *
 * Contract: relative paths are relative to the Graphify output directory
 * (`…/graphify-out`), not the repository root. Absolute paths are used as-is.
 * Out-of-repo / symlink escapes → `''`. Original Graphify value stays in metadata.
 */
export function relativizeSourceFile(
  sourceFile: string | undefined,
  options: RelativizeSourceFileOptions = {},
): string {
  if (!sourceFile) {
    return '';
  }

  const { repositoryRoot, graphifyOutputDir } = options;
  const normalizedInput = toPosix(sourceFile);

  const candidates: string[] = [];

  if (isAbsolute(sourceFile)) {
    candidates.push(sourceFile);
  } else {
    // Contract: relative paths are usually relative to Graphify output dir.
    if (graphifyOutputDir) {
      candidates.push(resolve(graphifyOutputDir, sourceFile));
    }
    // Some Graphify runs emit repo-relative paths (e.g. `src/foo.ts`).
    if (repositoryRoot) {
      candidates.push(resolve(repositoryRoot, sourceFile));
    }
    if (candidates.length === 0) {
      if (normalizedInput === '..' || normalizedInput.startsWith('../')) {
        return '';
      }
      return normalizedInput;
    }
  }

  if (!repositoryRoot) {
    return toPosix(candidates[0]!);
  }

  for (const candidate of candidates) {
    if (isPathInsideRoot(repositoryRoot, candidate)) {
      return toPosix(
        relative(tryRealpath(repositoryRoot), tryRealpath(candidate)),
      );
    }
  }

  return '';
}

export function mapGraphifyNode(
  node: GraphifyNode,
  options: RelativizeSourceFileOptions = {},
): GraphNode<GraphifyNodeMetadata> {
  const type = inferNodeType(node);
  const filePath = relativizeSourceFile(node.source_file, options);
  const sourceType =
    typeof node.file_type === 'string'
      ? node.file_type
      : typeof node._origin === 'string'
        ? node._origin
        : undefined;

  return {
    id: toGraphifyNodeId(node.id),
    type,
    name: node.label,
    location: {
      filePath,
      startLine: parseStartLine(node.source_location),
      endLine: parseEndLine(node.source_location),
    },
    evidence: [
      {
        id: createEvidenceId(),
        source: 'graphify',
        origin: typeof node._origin === 'string' ? node._origin : 'unknown',
        filePath: filePath || undefined,
        location: node.source_location,
      },
    ],
    metadata: {
      producer: 'graphify',
      sourceFile: node.source_file,
      sourceLocation: node.source_location,
      ...(sourceType ? { sourceType } : {}),
    },
  };
}

export class GraphifyNodeMapper implements NodeMapper<GraphifyNode> {
  constructor(private readonly options: RelativizeSourceFileOptions = {}) {}

  map(node: GraphifyNode): GraphNode<GraphifyNodeMetadata> {
    return mapGraphifyNode(node, this.options);
  }
}
