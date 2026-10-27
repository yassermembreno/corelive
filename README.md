# CoreLive

> A living knowledge model for understanding software systems.

CoreLive transforms source code repositories into a structured, queryable model of software knowledge.

## Status

Phase 0 — **Graphify-native** indexing (in progress / vertical slice).

Graphify is the extraction engine. CoreLive governs it, validates output, maps to `KnowledgeSnapshot`, and persists atomically to SQLite.

```text
repository → Graphify (pinned) → validated graph.json → KnowledgeSnapshot → SQLite
```

### Done

- [x] Monorepo foundation (pnpm + Turbo)
- [x] Domain model (`@corelive/domain`)
- [x] Graphify boundary freeze (`graphifyy==0.9.16`)
- [x] SourceIdentity + content fingerprint
- [x] Graphify schema/mapper/snapshot validators
- [x] GraphifyRunner + GraphifySourceIndexer
- [x] IndexRepository + IndexOutcome
- [x] SQLite GraphRepository (atomic + UNIQUE)
- [x] CLI: `corelive doctor | setup | index`

### Next

- [ ] Deterministic graph queries (who-calls, dependents, path)
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

## Packages

```text
packages/
  domain/              # KnowledgeSnapshot, GraphNode, GraphEdge, SourceIdentity
  core-engine/         # IndexRepository, ports, fingerprint, Result
  source-graphify/     # Graphify runner, validators, mappers, indexer
  storage-sqlite/      # SqliteGraphRepository
apps/
  cli/                 # corelive doctor | setup | index
  api/                 # Hono stub
```

## License

TBD
