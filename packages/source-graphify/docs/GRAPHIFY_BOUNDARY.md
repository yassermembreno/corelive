# Graphify boundary freeze (Phase 0)

Captured with a real headless extract against `test/fixtures/mini-repo`.

Package: `@corelive/source-graphify`

## Pin

| Item | Value |
| --- | --- |
| Package | `graphifyy` |
| Version | `0.9.16` |
| CLI | `graphify` |

PyPI may be ahead (`0.10.0`). CoreLive pins the version we verified.

## Argv

```bash
graphify extract <absRepo> --code-only --no-cluster --out <coreliveDir>
```

- `--no-viz` is **not** accepted by `extract` (only by `cluster-only`).
- `--code-only` = local AST, no API key / LLM.
- `--no-cluster` = raw extraction, no HTML in this run.

## Output layout

```text
<coreliveDir>/graphify-out/graph.json
```

`--out DIR` does **not** write `DIR/graph.json`; it nests `graphify-out/`.

## Schema (frozen)

Top-level keys: `nodes`, `edges`, `hyperedges`, `input_tokens`, `output_tokens`.

- Uses **`edges`**, not `links`.
- No NetworkX envelope (`directed` / `multigraph` / `graph`).
- Relations observed: `calls`, `contains`, `imports`, `imports_from`, `method`, `references`.

See `test/fixtures/graphify-captured/CAPTURE.json` and `graph.json`.

## Fingerprint

```text
HEAD
+ sha256(git diff HEAD --binary)
+ sorted "path:sha256(content)" for untracked (exclude-standard)
```

## EdgeId

```text
sha256(sourceNodeId \0 targetNodeId \0 sourceRelation \0 normalizedLocation \0 normalizedEvidence)
```

Identical structural edges collide → dedupe / structural duplicate. No position index.

## Snapshot UNIQUE (SQLite)

```sql
UNIQUE (
  source_id,
  content_fingerprint,
  extractor,
  extractor_version,
  canonical_schema_version
)
```

Concurrency: UNIQUE violation → load existing → `UNCHANGED`.

## Known Graphify quirks (mapper later)

- `source_file` paths are relative to the **output** directory when `--out` is outside the repo.
- Node `id` values may embed absolute machine path segments.
