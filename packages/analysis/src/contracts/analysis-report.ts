import { EdgeType, NodeType } from '@corelive/domain';
import { z } from 'zod';

const EdgeTypeSchema = z.nativeEnum(EdgeType);
const NodeTypeSchema = z.nativeEnum(NodeType);

export const EvidenceAvailabilitySchema = z.enum([
  'valid',
  'incomplete',
  'missing',
]);

export const EvidenceRecordSchema = z.object({
  id: z.string(),
  source: z.string().optional(),
  origin: z.string().optional(),
  filePath: z.string().optional(),
  location: z.string().optional(),
  availability: EvidenceAvailabilitySchema,
  reason: z.string().optional(),
});

export const ObservedRelationSchema = z.object({
  edgeId: z.string(),
  type: EdgeTypeSchema,
  sourceId: z.string(),
  targetId: z.string(),
  sourceRelation: z.string().optional(),
  evidence: z.array(EvidenceRecordSchema),
});

export const ObservedBlockSchema = z.object({
  snapshotId: z.string(),
  node: z.object({
    id: z.string(),
    name: z.string(),
    type: NodeTypeSchema,
    filePath: z.string(),
    startLine: z.number().optional(),
    endLine: z.number().optional(),
  }),
  /** Explicit documentary rationale only; null when absent. Never inferred from the name. */
  rationale: z.string().nullable(),
  localStructure: z.array(ObservedRelationSchema),
  incidentRelations: z.array(ObservedRelationSchema),
  evidence: z.array(EvidenceRecordSchema),
});

export const ReachSchema = z.object({
  nodeId: z.string(),
  name: z.string(),
  depth: numberOrZero(),
  edgeType: EdgeTypeSchema,
  pathEdgeIds: z.array(z.string()),
});

function numberOrZero() {
  return z.number().int().min(0);
}

export const DerivedImpactSchema = z.object({
  structuralConsumers: z.array(ReachSchema),
  moduleBindings: z.array(ReachSchema),
  references: z.array(ReachSchema),
  truncated: z.boolean(),
  maxDepth: z.number().int(),
  direction: z.literal('incoming'),
  edgeTypesApplied: z.array(EdgeTypeSchema),
});

export const DerivedExplainSchema = z.object({
  outgoingByType: z.record(z.string(), z.array(ReachSchema)),
  callers: z.array(ReachSchema),
  truncated: z.boolean(),
  maxDepth: z.number().int(),
  edgeTypesApplied: z.array(EdgeTypeSchema),
});

export const DerivedBlockSchema = z.object({
  explain: DerivedExplainSchema.optional(),
  impact: DerivedImpactSchema.optional(),
  /** Present only when TestEvidenceTool is implemented; empty/absent in P0. */
  relatedTests: z
    .array(
      z.object({
        testId: z.string(),
        relationKind: z.enum(['exercises', 'imports']),
        provenance: z.enum(['explicit', 'derived', 'unverified']),
      }),
    )
    .optional(),
});

export const HypothesisSchema = z.object({
  kind: z.literal('hypothesis'),
  text: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
});

export const InferredBlockSchema = z.object({
  responsibility: HypothesisSchema.nullable(),
  participation: HypothesisSchema.nullable(),
  behavior: HypothesisSchema.nullable(),
  /** Must be null when observed.rationale is null. */
  motivation: HypothesisSchema.nullable(),
  consequences: z.array(HypothesisSchema).default([]),
});

export const LimitationSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const AnalysisReportSchema = z.object({
  operation: z.enum(['explain', 'impact']),
  snapshotId: z.string(),
  symbol: z.string(),
  observed: ObservedBlockSchema,
  derived: DerivedBlockSchema,
  inferred: InferredBlockSchema.nullable(),
  limitations: z.array(LimitationSchema),
  meta: z.object({
    modelUsed: z.boolean(),
    promptVersion: z.string().optional(),
    latencyMs: z.number().nonnegative(),
  }),
});

export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;
export type InferredBlock = z.infer<typeof InferredBlockSchema>;
export type ObservedBlock = z.infer<typeof ObservedBlockSchema>;
export type ObservedRelation = z.infer<typeof ObservedRelationSchema>;
export type DerivedBlock = z.infer<typeof DerivedBlockSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type Limitation = z.infer<typeof LimitationSchema>;
