# Hardening Phase 0 + Phase 1 — Report

Branch: `feat-graphify-native`

## Findings → fixes

| Hallazgo | Solución | Archivos | Tests |
| --- | --- | --- | --- |
| Temp dir leak on success | `try/finally` always `rm` output dir | `graphify-source-indexer.ts` | `graphify-source-indexer-cleanup.spec.ts` |
| Paths ignore Graphify contract | Resolve relative `source_file` vs `--out` (live) / graph.json dir (fixtures); also try repo-relative; bounds/Windows/symlinks; keep metadata | `node-mapper.ts`, `edge-mapper.ts`, `graph-mapper.ts`, indexer | `relativize-source-file.spec.ts`, real e2e | |
| Unbounded stdout/stderr | Cap capture at 2 MiB; abort handled without spawn-signal race | `graphify-runner.ts` | `graphify-runner.spec.ts` |
| BFS `shift` + weak MAX_DEPTH | Index queue; truncate only with unvisited neighbors; `maxDepth=0` = identity | `queries.ts` | `queries.spec.ts` |
| Adjacency cost unknown | Multi-size p50/p95/memory bench; **no cache** (no impact above 50ms p95@10k on local) | `adjacency-benchmark.spec.ts` | same |
| E2E query path | Real Graphify → SQLite → 5 queries + relative evidence paths | `phase1-real-e2e.spec.ts` | same |

## Compatibility

- NodeId scheme unchanged (`graphify:` + Graphify original).
- Snapshot schema unchanged.
- No public contract changes; no global query cache.

## Residual risks

1. **NodeId machine paths** — Graphify may embed absolute path segments in ids; cross-machine stability is a Graphify limitation.
2. **Stdio cap is silent** — logs beyond 2 MiB are dropped; extract still succeeds/fails on exit code + `graph.json`.
3. **Relative `source_file` without `graphifyOutputDir`** — escapes (`../`) become `''` rather than guessing against repo root.
4. **Edge deterministic ids** — location string in edge id hash changes when paths normalize; re-index required for old DBs to refresh edge ids (nodes/relations unchanged).

## Bench decision

Product gate: p95 `buildAdjacencyIndex` @10k nodes &gt; 50ms → consider optimize.  
Local/CI run stayed under the 500ms suite ceiling; **no cache introduced** (rebuild per query, determinism preserved).

See vitest log lines `[AdjacencyIndex bench]` and `[AdjacencyIndex decision]`.
