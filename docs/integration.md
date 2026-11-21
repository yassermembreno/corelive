# Integrating with `@corelive/analysis`

## Contract

```ts
import { runAnalysis } from '@corelive/analysis';

const result = await runAnalysis(
  {
    operation: 'explain' | 'impact',
    symbol: string,
    snapshotId?: string,
    maxDepth?: number,      // 0..5
    edgeTypes?: EdgeType[],
    noModel?: boolean,
  },
  {
    graphRepository,        // GraphRepository (required)
    model?: LanguageModel | null,
    logger?: AnalysisLogger,
    limits?: Partial<AnalysisLimits>,
  },
);
```

Inputs and the returned `AnalysisReport` are validated with Zod.

## Errors

| Code | Meaning |
| --- | --- |
| `INVALID_REQUEST` | Request failed Zod validation |
| `SNAPSHOT_NOT_FOUND` | Missing snapshot |
| `SYMBOL_NOT_FOUND` | No matching node |
| `SYMBOL_AMBIGUOUS` | Multiple matches (candidates listed) |

## Example

[`examples/consume-analysis.ts`](../examples/consume-analysis.ts) imports the package from outside the CLI, injects an in-memory repository, runs `explain` with `noModel: true`, and writes JSON.

```bash
pnpm exec tsx examples/consume-analysis.ts
```

## CLI

```bash
corelive explain <symbol> [--snapshot id] [--json] [--no-model]
corelive analyze impact <symbol> [--snapshot id] [--depth n] [--type EdgeType] [--json] [--no-model]
```

`--no-model` exercises deterministic infrastructure. It does **not** demonstrate the agentic specialist.

## Security notes

- The LLM cannot open SQLite, the filesystem, or shell tools.
- Evidence and repository text are treated as untrusted data.
- Logs omit prompts, source snippets, and environment secrets.
