import { z } from 'zod';

export const AnalysisLimitsSchema = z.object({
  maxDepth: z.number().int().min(0).max(5).default(3),
  maxNodes: z.number().int().min(1).max(500).default(100),
  maxEdges: z.number().int().min(1).max(1000).default(200),
  maxEvidenceItems: z.number().int().min(1).max(200).default(50),
  modelTimeoutMs: z.number().int().min(1000).max(120_000).default(30_000),
});

export type AnalysisLimits = z.infer<typeof AnalysisLimitsSchema>;

export function resolveLimits(
  input?: Partial<AnalysisLimits>,
): AnalysisLimits {
  return AnalysisLimitsSchema.parse(input ?? {});
}
