# CoreLive

> A living knowledge model for understanding software systems.

CoreLive transforms source code repositories into a structured, queryable model of software knowledge — then explains components and their structural impact with evidence.

## Status

Phase 0 — Graphify-native indexing: **done**.  
Phase 1 — Deterministic graph queries: **done**.  
Phase 2 — Explain, Impact & test-evidence coverage gate: **done (P0)**.

Graphify is the extraction engine. CoreLive governs it, validates output, maps to `KnowledgeSnapshot`, persists atomically to SQLite, answers deterministic queries, and produces structured analysis reports.

```text
repository → Graphify (pinned) → KnowledgeSnapshot → SQLite
                                         ↓
                         corelive query | explain | analyze impact
                                         ↓
                              AnalysisReport (observed / derived / inferred)
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
- [x] Pure graph queries (`@corelive/graph`) including bounded neighborhood
- [x] SnapshotQueryService
- [x] CLI: `corelive doctor | setup | index | query …`
- [x] `@corelive/analysis` orchestrator + tools + local specialist port
- [x] CLI: `corelive explain` / `corelive analyze impact`
- [x] Deterministic + agentic evaluation suites

### Next (P1)

- [ ] Specialized test extraction / TestEvidenceTool (gate closed in P0)
- [ ] Given–When–Then scenario generation
- [ ] Guided onboarding
- [ ] Dashboard / HTTP API surfaces

## Requirements

- Node.js >= 22
- pnpm >= 9
- [uv](https://docs.astral.sh/uv/) (for Graphify install)
- Graphify via `corelive setup` (`graphifyy==0.9.16`)
- Optional for agentic mode: [Ollama](https://ollama.com/) + a local model (`CORELIVE_MODEL`, default `llama3.2`)

## Install CLI

```bash
pnpm install
pnpm --filter @corelive/cli link --global
```

Then use `corelive` from any directory:

```bash
corelive setup
corelive doctor
corelive index ./mi-repo
corelive query who-calls reserve
corelive explain .reserve() --no-model --json
corelive analyze impact .reserve() --no-model --json
```

Snapshots are stored under `~/.corelive/corelive.sqlite` (override with `CORELIVE_DATA_DIR`).

Relative paths (`./mi-repo`) resolve from **your shell directory** (via `INIT_CWD` / cwd), not from `apps/cli`.

### Smoke (from monorepo root)

```bash
export CORELIVE_DATA_DIR=/tmp/corelive-demo
corelive doctor
corelive index ./packages/source-graphify/test/fixtures/mini-repo
corelive query who-calls reserve
corelive query path create reserve
corelive query evidence reserve
corelive explain .reserve() --no-model
corelive analyze impact .reserve() --depth 3 --no-model --json
```

### Agentic (optional)

```bash
ollama pull llama3.2
export CORELIVE_MODEL=llama3.2
corelive explain .reserve() --json
```

`--no-model` proves deterministic infrastructure. It does **not** replace a real Ollama run for agentic evaluation.

### Fallback without global link

```bash
pnpm corelive -- doctor
pnpm corelive -- index ./packages/source-graphify/test/fixtures/mini-repo
pnpm corelive -- explain .reserve() --no-model --json
```

## Evaluation

```bash
pnpm --filter @corelive/analysis eval          # deterministic → eval/reports/deterministic.json
CORELIVE_MODEL=llama3.2 \
  pnpm --filter @corelive/analysis eval:model  # agentic → eval/reports/agentic.json
```

See [`docs/evaluation.md`](docs/evaluation.md).

## Integration

Programmatic API: `runAnalysis(request, dependencies)` from `@corelive/analysis`.

```bash
pnpm exec tsx examples/consume-analysis.ts
```

Docs: [`docs/integration.md`](docs/integration.md), [`docs/architecture/agentic-analysis.md`](docs/architecture/agentic-analysis.md).

## Query notes

Symbol resolution is exact `id`, then exact `name`, then deterministic expansions (`reserve` → `.reserve()`, `create` → `.create()`). Ambiguous matches list candidates (no fuzzy search).

```bash
corelive query who-calls reserve
corelive query dependents reserve --type CALLS
corelive query dependencies create
corelive query path create reserve
corelive query evidence reserve --snapshot <id>
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
  graph/               # Pure in-memory queries (adjacency, who-calls, path, neighborhood)
  core-engine/         # IndexRepository, SnapshotQueryService, ports
  source-graphify/     # Graphify runner, validators, mappers, indexer
  storage-sqlite/      # SqliteGraphRepository
  analysis/            # Explain / Impact orchestrator, tools, specialist port
apps/
  cli/                 # corelive doctor | setup | index | query | explain | analyze
  api/                 # Hono stub
eval/
  dataset.json         # Deterministic cases
  reports/             # deterministic.json + agentic.json
```

## License

TBD
