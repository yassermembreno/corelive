# Semantic fidelity hardening

Date: 2026-11-21  
Branch: `feat-graphify-native`  
Scope: Agentic explain must not contradict observed graph direction/EdgeType

## Before (false PASS)

Recorded in the prior [`eval/reports/agentic.json`](../../eval/reports/agentic.json) (2026-11-21T23:46:15Z):

| Item | Value |
| --- | --- |
| Suite status | `passed` |
| Graph fact | `e_bc`: `n_b` (beta) `-CALLS->` `n_c` (gamma) |
| Model narrative | `"gamma calls beta and imports alpha, referencing lonely."` |
| Checks that passed | JSON valid, evidenceRefs ⊆ authorized ids, weak lexical rubric |
| Checks missing | Direction, EdgeType, structured claims |

Conclusion: valid JSON that contradicted the graph was accepted as PASS.

## Changes

1. Additive `claims[]` on `InferredBlock` (`subjectId`, `predicate`, `objectId`, `evidenceRefs`).
2. `validateInferred` checks claims against `authorizedRelations` (reject invert / type mismatch / edge cited without claim).
3. Prompts require claims before narrative; forbid inverted CALLS.
4. Agentic eval requires `semanticFidelity` (claims + anti-inversion narrative heuristic).
5. Negative unit tests reproduce the gamma→beta defect.

No changes to `KnowledgeSnapshot`, NodeId/EdgeId strategies, or Graphify.

## After

| Suite | Result |
| --- | --- |
| `@corelive/analysis` unit tests | 23 passed (includes `semantic-fidelity.spec.ts`) |
| Deterministic eval (13 cases) | 13/13 → `eval/reports/deterministic.json` |
| Agentic eval (`CORELIVE_MODEL=llama3.2`) | **passed** with `semanticFidelity: true` |
| CLI e2e (phase0/1/2) | 6 passed |

Post-hardening agentic sample:

- Claim: `n_b CALLS n_c` (faithful)
- Narrative: `"beta calls gamma"` (not inverted)
- Metrics: `jsonValid`, `evidenceFidelity`, `semanticFidelity` all true

## Regressions

- Phase 0/1 query e2e: unchanged pass
- Phase 2 CLI explain/impact `--no-model`: unchanged pass
- Deterministic dataset size: still 13 (semantic negatives live in unit tests)

## How to re-run

```bash
pnpm --filter @corelive/analysis test
pnpm --filter @corelive/analysis eval
CORELIVE_MODEL=llama3.2 pnpm --filter @corelive/analysis eval:model
pnpm --filter @corelive/cli run test:e2e
```
