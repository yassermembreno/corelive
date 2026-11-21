import {
  LanguageModelError,
  LanguageModelTimeoutError,
  type LanguageModel,
  type LanguageModelRequest,
  type LanguageModelResponse,
} from './language-model.js';

export type OllamaAdapterOptions = {
  host?: string;
  model?: string;
};

export class OllamaAdapter implements LanguageModel {
  private readonly host: string;
  private readonly model: string;

  constructor(options: OllamaAdapterOptions = {}) {
    this.host = (
      options.host ??
      process.env.CORELIVE_OLLAMA_HOST ??
      'http://127.0.0.1:11434'
    ).replace(/\/$/, '');
    this.model =
      options.model ?? process.env.CORELIVE_MODEL ?? 'llama3.2';
  }

  async complete(
    request: LanguageModelRequest,
  ): Promise<LanguageModelResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    const started = Date.now();

    try {
      const response = await fetch(`${this.host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: 'json',
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.prompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new LanguageModelError(
          `Ollama HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const body = (await response.json()) as {
        message?: { content?: string };
        model?: string;
      };
      const text = body.message?.content ?? '';
      if (!text.trim()) {
        throw new LanguageModelError('Ollama returned empty content');
      }

      return {
        text,
        model: body.model ?? this.model,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      if (error instanceof LanguageModelError) {
        throw error;
      }
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || controller.signal.aborted)
      ) {
        throw new LanguageModelTimeoutError();
      }
      throw new LanguageModelError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
