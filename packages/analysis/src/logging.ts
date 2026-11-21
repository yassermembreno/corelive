export type AnalysisLogEvent = {
  operation: 'explain' | 'impact';
  model?: string;
  promptVersion?: string;
  latencyMs: number;
  result: 'ok' | 'invalid' | 'timeout' | 'skipped' | 'error';
  nodeCount?: number;
  edgeCount?: number;
  message?: string;
};

export type AnalysisLogger = {
  log(event: AnalysisLogEvent): void;
};

/** Default logger: structured fields only — never dumps evidence or prompts. */
export const consoleAnalysisLogger: AnalysisLogger = {
  log(event) {
    console.error(
      JSON.stringify({
        scope: 'corelive.analysis',
        ...event,
      }),
    );
  },
};

export const silentAnalysisLogger: AnalysisLogger = {
  log() {
    // no-op
  },
};
