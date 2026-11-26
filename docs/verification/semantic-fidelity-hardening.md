# Semantic fidelity hardening

Date: 2026-11-26  
Branch: `feat-graphify-native`  
Scope: Structured relational claims vs graph — not free-text semantic entailment

## Guarantees

CoreLive **certifies** structured `claims` against authorized graph relations:

- Direction (`subjectId` = edge source, `objectId` = edge target)
- Edge type (`CALLS` | `IMPORTS` | `REFERENCES` | `CONTAINS`)
- Evidence refs tied to that edge (`edgeId` or `evidenceId` mapped via `evidenceId → Set<edgeId>`)
- Non-null hypotheses require `evidenceRefs.length >= 1`
- Citing an edge (or edge-linked evidence) without a covering claim is rejected

## Limitations (explicit)

| Not guaranteed | Why |
| --- | --- |
| Full free-text fidelity | Narrative is hypothesis text; contradictory prose with correct claims is **not** auto-rejected |
| Paraphrase / NLP entailment | No language model judges narrative against the graph |
| `claimFidelity = true` ⇒ whole explanation faithful | Metrics are separated; claim fidelity ≠ narrative fidelity |

**Medium-term (not this change):** generate relational prose from validated claims; reserve the LLM for responsibility / behavior / consequences.

## Before (false PASS)

Prior agentic report (2026-11-21T23:46:15Z) marked `passed` while narrative said *"gamma calls beta"* against graph `beta -CALLS-> gamma`, because only JSON + id membership were checked.

## After — validation rules

1. Hypotheses without evidence → reject  
2. Claim evidence belonging to another edge → reject  
3. Ambiguous `evidenceId` (multiple edges) without disambiguating claim → reject  
4. Inverted relation claim → reject  
5. `IMPORTS` / `REFERENCES` claimed as `CALLS` → reject  
6. Non-relational narrative + node evidence, no claims → **accept** (unverified interpretation)  
7. Correct claims + contradictory narrative → claims accept; prose limit documented  

## Evaluation metrics (agentic)

| Metric | Meaning |
| --- | --- |
| `claimFidelity` | Structured claims vs graph |
| `narrativeHeuristicChecks` | Limited name-based free-text signals (not a guarantee) |
| `evidenceCoverage` | Share of non-null hypotheses with ≥1 evidence ref |

Fixture-specific `gamma`/`beta` regex is **not** a general pass criterion.

## How to re-run

```bash
pnpm --filter @corelive/analysis test
pnpm --filter @corelive/analysis eval
CORELIVE_MODEL=llama3.2 pnpm --filter @corelive/analysis eval:model
pnpm --filter @corelive/cli run test:e2e
```

## Results (2026-11-26)

| Suite | Result |
| --- | --- |
| Unit (`semantic-fidelity` + analysis) | 26 passed |
| Deterministic eval (13) | 13/13 |
| Agentic Ollama (`llama3.2`) | passed — `claimFidelity=true`, `evidenceCoverage=1`, narrative heuristic ok |
| CLI e2e (phase0/1/2) | 6 passed |

Blockers: none in this environment.
