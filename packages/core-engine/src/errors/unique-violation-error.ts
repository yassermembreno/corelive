export class UniqueViolationError extends Error {
  constructor(message?: string, options?: { cause?: unknown }) {
    super(message ?? 'UNIQUE constraint violated', options);
    this.name = 'UniqueViolationError';
  }
}

export function isUniqueViolation(error: unknown): boolean {
  if (error instanceof UniqueViolationError) {
    return true;
  }

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return true;
    }
    if (/UNIQUE constraint failed/i.test(error.message)) {
      return true;
    }
  }

  return false;
}
