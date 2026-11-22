import type { QueryError } from '@corelive/core-engine';
import { EdgeType, type KnowledgeSnapshot } from '@corelive/domain';

import {
  assembleContext,
  emptyOutgoingByType,
} from '../context/context-assembler.js';
import type { AnalysisRequest } from '../contracts/analysis-request.js';
import type {
  AnalysisReport,
  DerivedBlock,
  Limitation,
  ObservedBlock,
} from '../contracts/analysis-report.js';
import type { AnalysisLimits } from '../contracts/limits.js';
import { DEFAULT_ANALYSIS_EDGE_TYPES } from '../edge-semantics.js';
import type { AnalysisLogger } from '../logging.js';
import { ExplanationSpecialist } from '../specialist/explanation-specialist.js';
import type { LanguageModel } from '../specialist/language-model.js';
import {
  ComponentQueryTool,
  type ComponentQueryResult,
} from '../tools/component-query-tool.js';
import { DependencyTool } from '../tools/dependency-tool.js';

export type AnalysisDependencies = {
  graphRepository: ConstructorParameters<typeof ComponentQueryTool>[0];
  model?: LanguageModel | null;
  logger?: AnalysisLogger;
  limits?: Partial<AnalysisLimits>;
};

export type AnalysisFailure =
  | QueryError
  | { code: 'INVALID_REQUEST'; message: string };

function toObserved(
  snapshotId: string,
  component: ComponentQueryResult,
): ObservedBlock {
  return {
    snapshotId,
    node: {
      id: component.node.id,
      name: component.node.name,
      type: component.node.type,
      filePath: component.node.location.filePath,
      startLine: component.node.location.startLine,
      endLine: component.node.location.endLine,
    },
    rationale: component.rationale,
    localStructure: component.localStructure,
    incidentRelations: component.incidentRelations,
    evidence: component.evidence,
  };
}

function buildExplainDerived(
  snapshot: KnowledgeSnapshot,
  nodeId: string,
  maxDepth: number,
  edgeTypes: readonly EdgeType[],
  dependencyTool: DependencyTool,
): DerivedBlock {
  const outgoing = dependencyTool.query(snapshot, nodeId, {
    direction: 'outgoing',
    maxDepth,
    edgeTypes,
  });
  const callers = dependencyTool.query(snapshot, nodeId, {
    direction: 'incoming',
    maxDepth: 1,
    edgeTypes: [EdgeType.CALLS],
  });

  const outgoingByType = emptyOutgoingByType(edgeTypes);
  if (outgoing) {
    for (const [type, reaches] of outgoing.byType) {
      outgoingByType[type] = reaches;
    }
  }

  return {
    explain: {
      outgoingByType,
      callers: callers?.byType.get(EdgeType.CALLS) ?? [],
      truncated: Boolean(outgoing?.truncated),
      maxDepth,
      edgeTypesApplied: [...(outgoing?.edgeTypesApplied ?? edgeTypes)],
    },
  };
}

function buildImpactDerived(
  snapshot: KnowledgeSnapshot,
  nodeId: string,
  maxDepth: number,
  edgeTypes: readonly EdgeType[],
  dependencyTool: DependencyTool,
): DerivedBlock {
  const walkTypes = edgeTypes.filter((t) => t !== EdgeType.CONTAINS);
  const result = dependencyTool.query(snapshot, nodeId, {
    direction: 'incoming',
    maxDepth,
    edgeTypes: walkTypes,
  });

  return {
    impact: {
      structuralConsumers: result?.byType.get(EdgeType.CALLS) ?? [],
      moduleBindings: result?.byType.get(EdgeType.IMPORTS) ?? [],
      references: result?.byType.get(EdgeType.REFERENCES) ?? [],
      truncated: Boolean(result?.truncated),
      maxDepth,
      direction: 'incoming',
      edgeTypesApplied: [...(result?.edgeTypesApplied ?? walkTypes)],
    },
  };
}

function baseLimitations(
  operation: 'explain' | 'impact',
  derived: DerivedBlock,
  rationale: string | null,
  includeContains: boolean,
): Limitation[] {
  const limitations: Limitation[] = [
    {
      code: 'PATH_NOT_FAILURE',
      message:
        'A dependency path shows structural reachability, not a confirmed production failure.',
    },
    {
      code: 'TEST_EVIDENCE_UNAVAILABLE',
      message:
        'Graphify 0.9.16 did not emit test-path CALLS in the coverage study; TestEvidenceTool is postponed.',
    },
  ];

  if (rationale === null) {
    limitations.push({
      code: 'RATIONALE_ABSENT',
      message:
        'No explicit documentary rationale found. Motivation cannot be determined from the symbol name.',
    });
  }

  if (derived.explain?.truncated || derived.impact?.truncated) {
    limitations.push({
      code: 'NEIGHBORHOOD_TRUNCATED',
      message: 'Neighborhood walk hit maxDepth with unvisited neighbors remaining.',
    });
  }

  if (includeContains) {
    limitations.push({
      code: 'CONTAINS_INCLUDED',
      message:
        'CONTAINS was explicitly requested; hierarchy edges are not dependency consumers.',
    });
  } else if (operation === 'impact') {
    limitations.push({
      code: 'CONTAINS_EXCLUDED',
      message: 'CONTAINS hierarchy edges are excluded from the impact walk.',
    });
  }

  return limitations;
}

export class AnalysisOrchestrator {
  private readonly componentTool: ComponentQueryTool;
  private readonly dependencyTool = new DependencyTool();
  private readonly specialist: ExplanationSpecialist;
  private readonly limits: AnalysisLimits;

  constructor(
    private readonly deps: AnalysisDependencies,
    limits: AnalysisLimits,
    logger: AnalysisLogger,
  ) {
    this.componentTool = new ComponentQueryTool(deps.graphRepository);
    this.specialist = new ExplanationSpecialist(deps.model ?? null, logger);
    this.limits = limits;
  }

  async run(
    request: AnalysisRequest,
  ): Promise<
    | { ok: true; value: AnalysisReport }
    | { ok: false; error: AnalysisFailure }
  > {
    const started = Date.now();
    const component = await this.componentTool.query(
      request.symbol,
      request.snapshotId,
    );
    if (!component.ok) {
      return { ok: false, error: component.error };
    }

    const edgeTypes = request.edgeTypes ?? [...DEFAULT_ANALYSIS_EDGE_TYPES];
    const includeContains = edgeTypes.includes(EdgeType.CONTAINS);
    const maxDepth = request.maxDepth ?? this.limits.maxDepth;
    const snapshot = component.value.snapshot;
    const nodeId = component.value.node.id;

    const derived =
      request.operation === 'explain'
        ? buildExplainDerived(
            snapshot,
            nodeId,
            maxDepth,
            edgeTypes,
            this.dependencyTool,
          )
        : buildImpactDerived(
            snapshot,
            nodeId,
            maxDepth,
            edgeTypes,
            this.dependencyTool,
          );

    const observed = toObserved(snapshot.id, component.value);
    const assembled = assembleContext(observed, derived, this.limits);
    const limitations = baseLimitations(
      request.operation,
      assembled.derived,
      assembled.observed.rationale,
      includeContains,
    );

    let inferred = null;
    let modelUsed = false;
    let promptVersion: string | undefined;
    let specialistLatency = 0;

    if (!request.noModel) {
      const specialist = await this.specialist.interpret({
        operation: request.operation,
        promptPayload: assembled.promptPayload,
        authorizedIds: assembled.authorizedIds,
        authorizedRelations: assembled.authorizedRelations,
        rationale: assembled.observed.rationale,
        timeoutMs: this.limits.modelTimeoutMs,
      });
      inferred = specialist.inferred;
      modelUsed = specialist.modelUsed;
      promptVersion = specialist.promptVersion;
      specialistLatency = specialist.latencyMs;
      if (specialist.limitation) {
        limitations.push(specialist.limitation);
      }
    }

    void specialistLatency;

    const report: AnalysisReport = {
      operation: request.operation,
      snapshotId: snapshot.id,
      symbol: request.symbol,
      observed: assembled.observed,
      derived: assembled.derived,
      inferred,
      limitations,
      meta: {
        modelUsed,
        promptVersion,
        latencyMs: Date.now() - started,
      },
    };

    return { ok: true, value: report };
  }
}
