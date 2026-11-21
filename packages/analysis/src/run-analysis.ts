import { AnalysisRequestSchema } from './contracts/analysis-request.js';
import type { AnalysisReport } from './contracts/analysis-report.js';
import { resolveLimits } from './contracts/limits.js';
import {
  consoleAnalysisLogger,
  type AnalysisLogger,
} from './logging.js';
import {
  AnalysisOrchestrator,
  type AnalysisDependencies,
  type AnalysisFailure,
} from './orchestrator/analysis-orchestrator.js';
import type { LanguageModel } from './specialist/language-model.js';

export type RunAnalysisDependencies = {
  graphRepository: AnalysisDependencies['graphRepository'];
  model?: LanguageModel | null;
  logger?: AnalysisLogger;
  limits?: AnalysisDependencies['limits'];
};

export async function runAnalysis(
  requestInput: unknown,
  dependencies: RunAnalysisDependencies,
): Promise<
  | { ok: true; value: AnalysisReport }
  | { ok: false; error: AnalysisFailure }
> {
  const parsed = AnalysisRequestSchema.safeParse(requestInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: parsed.error.message,
      },
    };
  }

  const limits = resolveLimits(dependencies.limits);
  const logger = dependencies.logger ?? consoleAnalysisLogger;
  const orchestrator = new AnalysisOrchestrator(
    {
      graphRepository: dependencies.graphRepository,
      model: dependencies.model ?? null,
      logger,
      limits,
    },
    limits,
    logger,
  );

  return orchestrator.run(parsed.data);
}
