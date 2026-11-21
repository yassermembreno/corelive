import { z } from 'zod';

/**
 * Conceptual TestEvidence contract.
 * Lives outside KnowledgeSnapshot. Not persisted in P0.
 * Assertions/conditions stay empty unless the graph supplies them.
 */
export const TestEvidenceSchema = z.object({
  id: z.string().min(1),
  filePath: z.string().min(1),
  location: z.string().optional(),
  framework: z.enum(['vitest', 'jest', 'node:test', 'unknown']).default('unknown'),
  relatedComponentIds: z.array(z.string()),
  conditions: z.array(z.string()).default([]),
  assertions: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  relationKind: z.enum(['exercises', 'imports']),
  provenance: z.enum(['explicit', 'derived', 'unverified']),
  classification: z.enum([
    'functional_scenario',
    'technical_scenario',
    'unclassified',
  ]),
  classificationConfidence: z.enum(['determined', 'uncertain']),
});

export type TestEvidence = z.infer<typeof TestEvidenceSchema>;
