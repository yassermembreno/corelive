import type { IndexFailure } from '../ports/index-failure.js';
import type { IndexStage } from '../ports/index-outcome.js';

export class IndexError extends Error {
  readonly failure: IndexFailure;
  readonly stage: IndexStage;

  constructor(
    failure: IndexFailure,
    stage: IndexStage,
    message?: string,
    options?: { cause?: unknown },
  ) {
    super(message ?? failure, options);
    this.name = 'IndexError';
    this.failure = failure;
    this.stage = stage;
  }
}
