export { runAnalysis, type RunAnalysisDependencies } from './run-analysis.js';
export {
  AnalysisRequestSchema,
  type AnalysisRequest,
} from './contracts/analysis-request.js';
export {
  AnalysisReportSchema,
  InferredBlockSchema,
  RelationClaimSchema,
  type AnalysisReport,
  type DerivedBlock,
  type EvidenceRecord,
  type Hypothesis,
  type InferredBlock,
  type ObservedBlock,
  type RelationClaim,
} from './contracts/analysis-report.js';
export {
  TestEvidenceSchema,
  type TestEvidence,
} from './contracts/test-evidence.js';
export {
  AnalysisLimitsSchema,
  resolveLimits,
  type AnalysisLimits,
} from './contracts/limits.js';
export {
  DEFAULT_ANALYSIS_EDGE_TYPES,
  describeEdgeSemantics,
  edgeRole,
} from './edge-semantics.js';
export {
  AnalysisOrchestrator,
  type AnalysisDependencies,
  type AnalysisFailure,
} from './orchestrator/analysis-orchestrator.js';
export { ComponentQueryTool } from './tools/component-query-tool.js';
export { DependencyTool } from './tools/dependency-tool.js';
export {
  EvidenceTool,
  classifyEvidence,
} from './tools/evidence-tool.js';
export {
  ExplanationSpecialist,
  PROMPT_VERSION,
} from './specialist/explanation-specialist.js';
export { OllamaAdapter } from './specialist/ollama-adapter.js';
export type { LanguageModel } from './specialist/language-model.js';
export {
  validateInferred,
  sanitizeInferredRaw,
  parseModelJson,
  relationsFromObserved,
  checkSemanticFidelity,
  type AuthorizedRelation,
} from './specialist/output-validator.js';
export {
  consoleAnalysisLogger,
  silentAnalysisLogger,
  type AnalysisLogger,
  type AnalysisLogEvent,
} from './logging.js';
