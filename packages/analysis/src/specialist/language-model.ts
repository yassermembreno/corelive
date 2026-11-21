export type LanguageModelRequest = {
  system: string;
  prompt: string;
  timeoutMs: number;
};

export type LanguageModelResponse = {
  text: string;
  model: string;
  latencyMs: number;
};

export type LanguageModel = {
  complete(request: LanguageModelRequest): Promise<LanguageModelResponse>;
};

export class LanguageModelTimeoutError extends Error {
  constructor(message = 'Language model timed out') {
    super(message);
    this.name = 'LanguageModelTimeoutError';
  }
}

export class LanguageModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LanguageModelError';
  }
}
