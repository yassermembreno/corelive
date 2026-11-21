import { EdgeType } from '@corelive/domain';
import { z } from 'zod';

const EdgeTypeSchema = z.nativeEnum(EdgeType);

export const AnalysisRequestSchema = z.object({
  operation: z.enum(['explain', 'impact']),
  symbol: z.string().min(1).max(512),
  snapshotId: z.string().min(1).optional(),
  maxDepth: z.number().int().min(0).max(5).optional(),
  edgeTypes: z.array(EdgeTypeSchema).min(1).optional(),
  /** When true, skip the language model and leave inferred null. */
  noModel: z.boolean().optional().default(false),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
