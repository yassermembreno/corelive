# Agentic analysis architecture (Phase 2)

```text
CLI / runAnalysis(request, dependencies)
          |
          v
AnalysisOrchestrator
          |
          +-- ComponentQueryTool
          +-- DependencyTool
          +-- EvidenceTool
          |
          v
ContextAssembler  (authorized ids + untrusted data envelope)
          |
          v
ExplanationSpecialist  (optional LanguageModel port)
          |
          v
OutputValidator  (Zod + id allow-list)
          |
          v
AnalysisReport { observed, derived, inferred, limitations }
```

## Knowledge separation

| Block | Owner | Contents |
| --- | --- | --- |
| `observed` | snapshot tools | Node, locations, literal relations, evidence records, `rationale` |
| `derived` | graph algorithms | Neighborhood walks, typed consumer lists, truncation |
| `inferred` | specialist only | Hypotheses validated against authorized ids |
| `limitations` | orchestrator | Missing evidence, truncations, policy warnings |

The model never mutates `observed` or `derived`. Failed inference yields `inferred: null` with facts intact.

`rationale` is documentary only (`DOCUMENTED_BY` / Graphify `rationale_for` / `cites`). Otherwise it is `null`. Symbol names never fill motivation.

## Edge semantics for impact

| EdgeType | Role in impact | Default walk |
| --- | --- | --- |
| `CALLS` | Structural consumer (invocation) | yes |
| `IMPORTS` | Module binding | yes |
| `REFERENCES` | Weak mention | yes |
| `CONTAINS` | Hierarchy only | **excluded** unless explicitly requested |
| `RELATED_TO` | Unmapped | excluded |

Reachability is not a confirmed production failure. Each EdgeType is walked independently so imports do not collapse call consumers.

## Specialist

- Port: `LanguageModel.complete({ system, prompt, timeoutMs })`
- Adapter: Ollama (`CORELIVE_OLLAMA_HOST`, `CORELIVE_MODEL`)
- Prompts: `packages/analysis/prompts/v1/`
- Repository text is untrusted data; instructions inside comments/tests/docs are ignored
- Logging records operation, latency, and result codes without dumping secrets or source

## Test evidence

See [`docs/analysis/test-evidence-coverage.md`](../analysis/test-evidence-coverage.md). Graphify 0.9.16 did not emit test-path `CALLS` in the coverage fixture, so `TestEvidenceTool` is postponed. The `TestEvidence` Zod contract remains in `@corelive/analysis` and is not persisted into `KnowledgeSnapshot`.

Given–When–Then scenario generation is explicitly out of P0.
