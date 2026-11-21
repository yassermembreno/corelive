# Test evidence coverage (Graphify 0.9.16)

Date: 2026-11-21  
Pin: `graphifyy==0.9.16`  
Command: `graphify extract <repo> --code-only --no-cluster --out <dir>`  
Fixture: [`packages/source-graphify/test/fixtures/test-coverage-repo`](../../packages/source-graphify/test/fixtures/test-coverage-repo)  
Captured graph: [`packages/source-graphify/test/fixtures/test-coverage-captured/graph.json`](../../packages/source-graphify/test/fixtures/test-coverage-captured/graph.json)

## Method

1. Built a real git repository with production code (`InventoryService.reserve`, `InventoryApi.placeHold`), a test that only imports (`import-only.spec.ts`), and a test that calls, asserts, and expects a throw (`exercises.spec.ts`).
2. Ran the pinned Graphify extract (no mocks, no hand-written graph).
3. Inspected node types, relations, and edges whose `source_file` path sits under `test/`.

## Observed schema

| Item | Value |
| --- | --- |
| Nodes | 14 |
| Edges | 18 |
| Node keys | `_origin`, `file_type`, `id`, `label`, `source_file`, `source_location` |
| Edge keys | `_origin`, `confidence`, `confidence_score`, `context`, `relation`, `source`, `source_file`, `source_location`, `target`, `weight` |
| `file_type` values | `code` only |
| Relations | `calls`, `contains`, `imports`, `imports_from`, `method`, `re_exports`, `references` |

No `TEST` / `TEST_CASE` node kinds. No `tested_by` relation. No assertion or expected-exception nodes.

## Coverage matrix

| Question | Status | Evidence from this extract |
| --- | --- | --- |
| Test → component (import) | **derived** | `imports` / `imports_from` from `exercises.spec.ts` and `import-only.spec.ts` → `InventoryService` / `inventory.ts` |
| Test → component (exercise / call) | **absent** | No `calls` edge whose `source_file` is under `test/`. Production does emit `calls` (`.placeHold()` → `.reserve()`). |
| Test → assertion | **absent** | `expect(...).resolves.toBe` / `rejects.toThrow` produce no nodes or edges. |
| Test → expected exception | **absent** | The throw path in production is not linked from the test; no exception relation exists. |

## Import vs exercise

| Spec | Graphify edges from test path | Interpretation for CoreLive |
| --- | --- | --- |
| `import-only.spec.ts` | `imports`, `imports_from`, `re_exports` | Structural binding only. Must never be presented as behavioral proof. |
| `exercises.spec.ts` | `imports`, `imports_from` only | Despite calling `service.reserve(...)` and asserting, Graphify did not emit `calls`. An import from a test file is not evidence that the test exercises the component. |

## Gate for `TestEvidenceTool`

Plan rule: implement the tool only when a real extract shows a `CALLS` edge from a test path to the component, with usable provenance.

**Result: gate closed.** This extract has test-path `IMPORTS` but no test-path `CALLS`.

P0 actions:

- Document coverage here (this file).
- Keep the `TestEvidence` TypeScript contract in `@corelive/analysis`, separate from `KnowledgeSnapshot`.
- Do **not** implement `TestEvidenceTool`.
- Do **not** invent assertions, exceptions, or business rules from test names.
- Evaluation cases that mention related tests must record absence / insufficient coverage instead of fabricating hits.

## Mapper notes

- Existing mapper already folds `imports_from` into `IMPORTS` and unknown relations (including `re_exports`) into `RELATED_TO`, preserving `metadata.sourceRelation`.
- Path-based “is this a test file?” heuristics inside Graphify are used only for call disambiguation; they do not create test evidence edges.

## Residual risks

1. Member calls inside Vitest `it()` callbacks may not create caller nodes; exercise edges may remain absent until Graphify changes or a dedicated test extractor is added (P1).
2. `imports_from` to an unresolved module (e.g. `vitest`) can produce a dangling edge target in raw Graphify output.
