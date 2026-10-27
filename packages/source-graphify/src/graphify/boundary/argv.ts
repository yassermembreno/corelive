import { GRAPHIFYY_PIN } from './pin.js';

/**
 * Frozen extract argv for Phase 0.
 *
 * Notes from real CLI (graphifyy@0.9.16):
 * - `extract` does NOT accept `--no-viz` (that flag belongs to cluster-only).
 * - `--no-cluster` skips HTML and writes raw extraction only.
 * - `--out DIR` writes to `<DIR>/graphify-out/graph.json` (not `<DIR>/graph.json`).
 */
export const GRAPHIFY_EXTRACT_FLAGS = [
  '--code-only',
  '--no-cluster',
] as const;

export function buildGraphifyExtractArgv(input: {
  repositoryPath: string;
  outputDirectory: string;
}): string[] {
  return [
    'extract',
    input.repositoryPath,
    ...GRAPHIFY_EXTRACT_FLAGS,
    '--out',
    input.outputDirectory,
  ];
}

export function assertCompatibleGraphifyVersion(version: string): boolean {
  const normalized = version.trim().replace(/^graphify\s+/i, '');
  return normalized === GRAPHIFYY_PIN;
}
