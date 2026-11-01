# CoreLive

> A living knowledge model for understanding software systems.

CoreLive transforms source code repositories into a structured, queryable model of software knowledge.

## Status

Phase 0 — Graphify-native indexing: **done**.  
Phase 1 — Deterministic graph queries: **done**.

Graphify is the extraction engine. CoreLive governs it, validates output, maps to `KnowledgeSnapshot`, persists atomically to SQLite, and answers deterministic queries.

```text
repository → Graphify (pinned) → validated graph.json → KnowledgeSnapshot → SQLite
                                                                     ↓
                                                              corelive query …
```

### Done

- [x] Monorepo foundation (pnpm + Turbo)
- [x] Domain model (`@corelive/domain`)
- [x] Graphify boundary freeze (`graphifyy==0.9.16`)
- [x] SourceIdentity + content fingerprint
- [x] Graphify schema/mapper/snapshot validators
- [x] GraphifyRunner + GraphifySourceIndexer
- [x] IndexRepository + IndexOutcome
- [x] SQLite GraphRepository (atomic + UNIQUE + getById/getLatest)
- [x] Pure graph queries (`@corelive/graph`)
- [x] SnapshotQueryService
- [x] CLI: `corelive doctor | setup | index | query …`

### Next

- [ ] Dashboard / API surfaces
- [ ] Additional sources (Git, OpenAPI, runtime)

## Requirements

- Node.js >= 22
- pnpm >= 9
- [uv](https://docs.astral.sh/uv/) (for Graphify install)
- Graphify via `corelive setup` (`graphifyy==0.9.16`)

## Install

```bash
pnpm install
pnpm --filter @corelive/cli exec tsx src/cli.ts setup
pnpm --filter @corelive/cli exec tsx src/cli.ts doctor
```

## Index a repository

```bash
pnpm --filter @corelive/cli exec tsx src/cli.ts index /path/to/repo
```

Snapshots are stored under `~/.corelive/corelive.sqlite` (override with `CORELIVE_DATA_DIR`).

## Query a snapshot

Graphify node names are exact labels (case-sensitive), e.g. `PublicController`, `.create()`, `.reserve()`. Prefer those over long `graphify:…` ids. Resolution order: exact `node.id`, then exact `node.name`. Ambiguous names fail with candidates.

```bash
pnpm --filter @corelive/cli exec tsx src/cli.ts query who-calls '.reserve()'
pnpm --filter @corelive/cli exec tsx src/cli.ts query dependents '.reserve()' --type CALLS
pnpm --filter @corelive/cli exec tsx src/cli.ts query dependencies '.create()'
pnpm --filter @corelive/cli exec tsx src/cli.ts query path '.create()' '.reserve()'
pnpm --filter @corelive/cli exec tsx src/cli.ts query evidence '.reserve()' --snapshot <id>
```

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Error (`SNAPSHOT_NOT_FOUND`, `SYMBOL_NOT_FOUND`, `SYMBOL_AMBIGUOUS`, invalid `--type`, …) |
| `2` | `NO_PATH` / `MAX_DEPTH_REACHED` (path query only; not an infra failure) |

Default snapshot is the latest (`ORDER BY created_at DESC, id DESC`). Pass `--snapshot <id>` to pin one. `--type` accepts comma-separated `EdgeType` values (`CALLS`, `IMPORTS`, `CONTAINS`, …).

## Packages

```text
packages/
  domain/              # KnowledgeSnapshot, GraphNode, GraphEdge, SourceIdentity
  graph/               # Pure in-memory queries (adjacency, who-calls, path, …)
  core-engine/         # IndexRepository, SnapshotQueryService, ports
  source-graphify/     # Graphify runner, validators, mappers, indexer
  storage-sqlite/      # SqliteGraphRepository
apps/
  cli/                 # corelive doctor | setup | index | query
  api/                 # Hono stub
```

## License

TBD
