import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { InferredBlock } from '../contracts/analysis-report.js';
import type { AnalysisLogger } from '../logging.js';
import {
  LanguageModelError,
  LanguageModelTimeoutError,
  type LanguageModel,
} from './language-model.js';
import {
  parseModelJson,
  validateInferred,
  type AuthorizedIds,
} from './output-validator.js';

export const PROMPT_VERSION = 'v1';

const here = dirname(fileURLToPath(import.meta.url));
const promptsRoot = join(here, '../../prompts', PROMPT_VERSION);

function loadPrompt(name: string): string {
  return readFileSync(join(promptsRoot, name), 'utf8');
}

export type SpecialistResult = {
  inferred: InferredBlock | null;
  limitation?: { code: string; message: string };
  modelUsed: boolean;
  promptVersion: string;
  result: 'ok' | 'invalid' | 'timeout' | 'skipped' | 'error';
  latencyMs: number;
};

export class ExplanationSpecialist {
  private readonly system = loadPrompt('system.md');
  private readonly explainPrompt = loadPrompt('explain.md');
  private readonly impactPrompt = loadPrompt('impact.md');

  constructor(
    private readonly model: LanguageModel | null,
    private readonly logger: AnalysisLogger,
  ) {}

  async interpret(input: {
    operation: 'explain' | 'impact';
    promptPayload: Record<string, unknown>;
    authorizedIds: AuthorizedIds;
    rationale: string | null;
    timeoutMs: number;
  }): Promise<SpecialistResult> {
    if (!this.model) {
      return {
        inferred: null,
        modelUsed: false,
        promptVersion: PROMPT_VERSION,
        result: 'skipped',
        latencyMs: 0,
      };
    }

    const userPrompt = [
      input.operation === 'explain' ? this.explainPrompt : this.impactPrompt,
      '',
      'Authorized context JSON:',
      JSON.stringify(input.promptPayload),
    ].join('\n');

    const attempt = async (): Promise<SpecialistResult> => {
      const started = Date.now();
      try {
        const response = await this.model!.complete({
          system: this.system,
          prompt: userPrompt,
          timeoutMs: input.timeoutMs,
        });
        const raw = parseModelJson(response.text);
        const validated = validateInferred(raw, input.authorizedIds, {
          rationale: input.rationale,
        });
        if (!validated.ok) {
          return {
            inferred: null,
            limitation: {
              code: 'INFERENCE_INVALID',
              message: validated.reason,
            },
            modelUsed: true,
            promptVersion: PROMPT_VERSION,
            result: 'invalid',
            latencyMs: Date.now() - started,
          };
        }
        return {
          inferred: validated.value,
          modelUsed: true,
          promptVersion: PROMPT_VERSION,
          result: 'ok',
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        if (error instanceof LanguageModelTimeoutError) {
          return {
            inferred: null,
            limitation: {
              code: 'INFERENCE_TIMEOUT',
              message: error.message,
            },
            modelUsed: true,
            promptVersion: PROMPT_VERSION,
            result: 'timeout',
            latencyMs: Date.now() - started,
          };
        }
        const message =
          error instanceof LanguageModelError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);
        return {
          inferred: null,
          limitation: {
            code: 'INFERENCE_ERROR',
            message,
          },
          modelUsed: true,
          promptVersion: PROMPT_VERSION,
          result: 'error',
          latencyMs: Date.now() - started,
        };
      }
    };

    let result = await attempt();
    if (result.result === 'invalid') {
      result = await attempt();
      if (result.result === 'invalid') {
        result = {
          ...result,
          limitation: {
            code: 'INFERENCE_INVALID',
            message:
              result.limitation?.message ??
              'Model output failed validation after retry',
          },
        };
      }
    }

    this.logger.log({
      operation: input.operation,
      promptVersion: PROMPT_VERSION,
      latencyMs: result.latencyMs,
      result: result.result,
      nodeCount: input.authorizedIds.nodeIds.size,
      edgeCount: input.authorizedIds.edgeIds.size,
      message: result.limitation?.code,
    });

    return result;
  }
}
