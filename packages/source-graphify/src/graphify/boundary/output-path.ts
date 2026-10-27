import { join } from 'node:path';

/** Graphify always nests output under `graphify-out/` inside `--out`. */
export const GRAPHIFY_OUT_DIRNAME = 'graphify-out' as const;

export const GRAPHIFY_GRAPH_FILENAME = 'graph.json' as const;

export function resolveGraphifyOutputDirectory(coreliveOutDir: string): string {
  return join(coreliveOutDir, GRAPHIFY_OUT_DIRNAME);
}

export function resolveGraphifyGraphJsonPath(coreliveOutDir: string): string {
  return join(
    resolveGraphifyOutputDirectory(coreliveOutDir),
    GRAPHIFY_GRAPH_FILENAME,
  );
}
