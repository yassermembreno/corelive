# Evaluation

Phase 2 keeps two independent suites. Metrics are never mixed.

## Deterministic

```bash
pnpm --filter @corelive/analysis eval
```

- Dataset: [`eval/dataset.json`](../eval/dataset.json) (13 cases)
- Report: [`eval/reports/deterministic.json`](../eval/reports/deterministic.json)
- Uses in-memory fixture graphs (stable names/paths; no machine-absolute NodeIds)
- Covers explain, direct CALLS, transitive impact, IMPORTS vs CALLS, evidence validity, inconsistent evidence paths, ambiguity, missing symbols, null rationale, truncation, CONTAINS exclusion, absent test evidence, and motivation nulling
- `--no-model` / `noModel: true` only — does not prove agentic capability

## Agentic

```bash
CORELIVE_MODEL=llama3.2 pnpm --filter @corelive/analysis eval:model
```

Requires a reachable Ollama (`CORELIVE_OLLAMA_HOST`, default `http://127.0.0.1:11434`) and a pulled model (`CORELIVE_MODEL`).

Measures:

- JSON / Zod validity
- Evidence fidelity (refs ⊆ authorized ids)
- Unsupported claims (motivation without rationale, import-as-behavior, path-as-failure)
- Rubric: concise, hypothesis markers, no name-based motivation
- Latency and degradation (`inferred: null` with facts intact)

Report: [`eval/reports/agentic.json`](../eval/reports/agentic.json)

### Recorded run (2026-11-21)

| Field | Value |
| --- | --- |
| Status | `passed` |
| Model | `llama3.2` via local Ollama |
| Host | `http://127.0.0.1:11434` |
| Result | `inferredPresent: true`, `jsonValid: true`, `evidenceFidelity: true` |

If Ollama is unavailable, the runner writes `status: "blocked"` and exits `2`. That state means the agentic evaluation is **incomplete** — do not mark Phase 2 agentic complete from deterministic results alone.
