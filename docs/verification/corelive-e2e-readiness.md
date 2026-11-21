# CoreLive E2E readiness verification

Date: 2026-11-21  
Scope: Graphify → KnowledgeSnapshot → SQLite → deterministic CLI queries  
Verdict: **PASS**

## 1. Git state

| Item | Value |
| --- | --- |
| Branch | `feat-graphify-native` |
| Commit SHA (baseline) | `9f63d938779f4cf78135fc4c2ddd18fae950a59e` |
| Working tree at start | clean |
| Working tree after verification | modified only for defects found in this run (see §8) |

Recent commits at baseline:

```text
9f63d93 DX cLI agregado
c91dad4 Se incorpora hardening de la fase de indexacion y queries
8b8a92b Se agregan graph queries
878f19d Se agrega cli con comandos doctor | setup | index
92e80cc Merge pull request #2 from yassermembreno/feat-parser
```

## 2. Tool versions

| Tool | Version |
| --- | --- |
| Node.js | v22.20.0 |
| pnpm | 10.33.0 |
| Python | 3.14.6 |
| uv | 0.9.5 |
| Graphify CLI | `graphify 0.9.16` (`/Users/yasse.rmembreno/.local/bin/graphify`) |
| Pin | `graphifyy==0.9.16` (`GRAPHIFYY_PIN`) |

## 3. Commands executed

Entrypoint used throughout (no global bin required):

```bash
pnpm corelive -- <args>
# equivalent without root script:
# pnpm --filter @corelive/cli exec node --import tsx ./src/cli.ts <args>
```

### Environment

```bash
pnpm install
pnpm corelive -- setup
pnpm corelive -- doctor
graphify --version
```

### Typecheck / unit / E2E

```bash
pnpm -r --if-present run typecheck
pnpm --filter @corelive/graph --filter @corelive/core-engine \
  --filter @corelive/source-graphify --filter @corelive/storage-sqlite \
  --filter @corelive/cli test
pnpm --filter @corelive/cli exec vitest run \
  test/phase0-e2e.spec.ts \
  test/phase1-query-e2e.spec.ts \
  test/phase1-real-e2e.spec.ts
pnpm --filter @corelive/cli run test:e2e
```

### Real CLI index + queries (isolated mini-repo)

Final successful run root: `/tmp/corelive-e2e-final-qQnMYx`

```bash
ROOT=$(mktemp -d /tmp/corelive-e2e-final-XXXXXX)
cp -R packages/source-graphify/test/fixtures/mini-repo "$ROOT/repo"
git -C "$ROOT/repo" init && git -C "$ROOT/repo" add . && git -C "$ROOT/repo" commit -m init
mkdir -p "$ROOT/data"
export CORELIVE_DATA_DIR="$ROOT/data"

pnpm corelive -- index "$ROOT/repo"          # INDEXED
pnpm corelive -- index "$ROOT/repo"          # UNCHANGED

pnpm corelive -- query who-calls '.reserve()'
pnpm corelive -- query dependents '.reserve()' --type CALLS
pnpm corelive -- query dependencies '.create()'
pnpm corelive -- query path '.create()' '.reserve()'
pnpm corelive -- query evidence '.reserve()'
```

Graphify used: real `graphify` 0.9.16 on PATH (not `fake-graphify.mjs`).

## 4. Test results

| Suite | Result |
| --- | --- |
| Typecheck (all packages with script) | PASS |
| `@corelive/graph` unit | 24/24 PASS |
| `@corelive/core-engine` unit | 16/16 PASS |
| `@corelive/source-graphify` unit | 25/25 PASS (after fix) |
| `@corelive/storage-sqlite` unit | 5/5 PASS |
| `@corelive/cli` unit+e2e | 10/10 PASS (after fix) |
| Phase 0 E2E | PASS |
| Phase 1 Query E2E | PASS |
| Phase 1 Real E2E | PASS |
| `test:e2e` (includes `dx-cli`) | PASS |

Notes:

- `packages/domain` and `apps/api` declare a placeholder `test` script that exits 1 by design; not treated as a flow failure.
- Node emits `ExperimentalWarning: SQLite is an experimental feature` on Node 22; informational only.

## 5. Indexation / reindexation

| Step | Result |
| --- | --- |
| First `index` | `Status: INDEXED` |
| Snapshot id | `snap_46a8907e-1a87-46eb-ae06-bd8f6570e572` |
| Extractor | `graphify` / `0.9.16` |
| SQLite counts | 1 snapshot, 11 nodes, 12 edges |
| Second `index` (no repo changes) | `Status: UNCHANGED`, same snapshot id |
| Snapshot count after reindex | 1 (no duplicates) |

Evidence paths after fix (sample):

| Node | `location.filePath` | metadata `sourceFile` (Graphify original) |
| --- | --- | --- |
| `.reserve()` | `src/service.ts` | `../repo/src/service.ts` |
| `.create()` | `src/controller.ts` | `../repo/src/controller.ts` |
| `package.json` | `package.json` | `../repo/package.json` |

CALLS edge present:

- source: `…_publiccontroller_create` (`.create()`)
- target: `…_publicreservationservice_reserve` (`.reserve()`)

## 6. Five queries

All via `pnpm corelive --` against `CORELIVE_DATA_DIR=/tmp/corelive-e2e-final-qQnMYx/data`.

| Query | Exit | Result |
| --- | --- | --- |
| `query who-calls '.reserve()'` | 0 | 1 caller: `.create()` via `CALLS`, evidence `ast src/controller.ts L7` |
| `query dependents '.reserve()' --type CALLS` | 0 | 1 dependent: `.create()` |
| `query dependencies '.create()'` | 0 | includes `.reserve()` via `CALLS` |
| `query path '.create()' '.reserve()'` | 0 | path length 1, directed `CALLS` |
| `query evidence '.reserve()'` | 0 | location `src/service.ts:2`, origin `ast`, incident `CALLS` + `CONTAINS` |

Symbol resolution / exit codes:

| Case | Exit | Output |
| --- | --- | --- |
| Missing symbol `TotallyMissingSymbolXYZ` | 1 | `SYMBOL_NOT_FOUND: TotallyMissingSymbolXYZ` |
| Ambiguous symbol | n/a | Fixture node names are unique; no `SYMBOL_AMBIGUOUS` case available without changing the fixture |
| Missing repository path | 1 | `Status: FAILED` / `Failure: SOURCE_NOT_FOUND` / message with path |

Repeated `who-calls '.reserve()'` produced identical stdout (deterministic).

## 7. Integrity checks

| Check | Result |
| --- | --- |
| Edge `source`/`target` exist as nodes | PASS (0 dangling) |
| Duplicate snapshot / node / edge ids | PASS (0) |
| Evidence / location paths valid under repo copy | PASS (`src/service.ts`, `src/controller.ts`, `package.json`) |
| No temp / absolute / `..` leakage in stored paths | PASS |
| Snapshot identity after reload (`ORDER BY created_at DESC, id DESC`) | PASS (same id) |
| Graphify temp dirs removed after index | PASS (no leftover `.corelive-graphify-*`) |
| Errors surface stage/failure/message | PASS (`SOURCE_NOT_FOUND`) |

Residual cosmetic: pnpm recursive exec prints an extra `undefined` line after non-zero CLI exits; CoreLive’s own error lines remain present.

## 8. Problems found and fixes

### Defect A — empty TypeScript evidence paths under `/tmp` repos

**Class:** implementation defect (triggered by Graphify quirk)

**Reproduction:** index a repo under `/tmp/...` while Graphify `--out` lived under macOS `os.tmpdir()` (`/var/folders/...`). Graphify then emitted bare basenames (`service.ts`, `controller.ts`). Relativization against the repo root failed for those basenames → empty `filePath`.

**Fix (minimal):** create Graphify `--out` as a sibling under the repository’s real parent (`.corelive-graphify-*`), with fallback to `os.tmpdir()` if the parent is not writable.

Files:

- `packages/source-graphify/src/graphify/graphify-source-indexer.ts`
- `packages/source-graphify/test/graphify-source-indexer-cleanup.spec.ts`

### Defect B — `pnpm corelive -- query … --type` broke option parsing

**Class:** implementation / DX defect

**Reproduction:** `pnpm corelive -- query dependents '.reserve()' --type CALLS` injected a lone `--` into Commander argv, so `--type` became a positional → `too many arguments for 'dependents'`.

**Fix (minimal):** strip only the pnpm-injected `--` immediately after the script path.

Files:

- `apps/cli/src/argv-for-commander.ts` (new)
- `apps/cli/src/cli.ts`
- `apps/cli/test/argv-for-commander.spec.ts` (new)
- `apps/cli/test/dx-cli.spec.ts`

### Not changed

- `KnowledgeSnapshot` schema, `NodeId` strategy, Graphify pin `0.9.16`
- No agents, RAG, API, dashboard, HugeGraph, Graphology, or jQAssistant

## 9. Residual risks

1. **Graphify NodeIds embed machine path segments** (e.g. `private_tmp_…`). Cross-machine id stability remains a Graphify limitation.
2. If the repository parent is not writable, fallback `--out` under `os.tmpdir()` can still produce bare basenames and empty paths (same class as Defect A).
3. Stdio capture remains capped at 2 MiB (silent truncation); extract success still depends on exit code + `graph.json`.
4. Fixture has no ambiguous symbol names; `SYMBOL_AMBIGUOUS` was not exercised on real Graphify output.
5. Node.js SQLite API is experimental on Node 22.

## 10. Repeat from a clean clone

```bash
git clone <repo-url> corelive
cd corelive
git checkout feat-graphify-native
pnpm install
pnpm corelive -- setup
pnpm corelive -- doctor   # expect graphify 0.9.16

pnpm -r --if-present run typecheck
pnpm --filter @corelive/cli run test:e2e

ROOT=$(mktemp -d /tmp/corelive-e2e-XXXXXX)
cp -R packages/source-graphify/test/fixtures/mini-repo "$ROOT/repo"
git -C "$ROOT/repo" init && git -C "$ROOT/repo" add . && \
  GIT_AUTHOR_NAME=CoreLive GIT_AUTHOR_EMAIL=test@corelive.local \
  GIT_COMMITTER_NAME=CoreLive GIT_COMMITTER_EMAIL=test@corelive.local \
  git -C "$ROOT/repo" commit -m init
mkdir -p "$ROOT/data"
export CORELIVE_DATA_DIR="$ROOT/data"

pnpm corelive -- index "$ROOT/repo"
pnpm corelive -- index "$ROOT/repo"   # expect UNCHANGED
pnpm corelive -- query who-calls '.reserve()'
pnpm corelive -- query dependents '.reserve()' --type CALLS
pnpm corelive -- query dependencies '.create()'
pnpm corelive -- query path '.create()' '.reserve()'
pnpm corelive -- query evidence '.reserve()'

rm -rf "$ROOT"
```

Requirements: Node.js ≥ 22, pnpm ≥ 9, `uv`, network once for `graphifyy==0.9.16`.

## 11. Verdict

**PASS**

Mandatory checks succeeded after the two minimal fixes above:

- `setup` / `doctor` with pinned Graphify 0.9.16
- Real CLI index → `INDEXED`, reindex → `UNCHANGED` without duplicate snapshots
- SQLite snapshot with nodes, relations, and evidence
- All five queries with expected semantics and exit codes
- Path integrity and temp cleanup
