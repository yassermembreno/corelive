import {
  EdgeType,
  GraphSource,
  NodeType,
  type GraphEdge,
  type GraphNode,
  type KnowledgeSnapshot,
} from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import { buildAdjacencyIndex } from '../src/adjacency.js';
import {
  queryDependencies,
  queryDependents,
  queryEvidence,
  queryPath,
  queryWhoCalls,
} from '../src/queries.js';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

function syntheticSnapshot(nodeCount: number): KnowledgeSnapshot {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (let i = 0; i < nodeCount; i += 1) {
    nodes.push({
      id: `n_${i}`,
      name: `N${i}`,
      type: NodeType.METHOD,
      metadata: {},
      location: { filePath: `f${i}.ts`, startLine: 1 },
      evidence: [],
    });
  }

  // Sparse chain + a few cross links → ~2 edges per node average
  for (let i = 0; i < nodeCount - 1; i += 1) {
    edges.push({
      id: `e_${i}`,
      type: EdgeType.CALLS,
      source: `n_${i}`,
      target: `n_${i + 1}`,
      metadata: {},
      evidence: [],
    });
    if (i % 7 === 0 && i + 3 < nodeCount) {
      edges.push({
        id: `e_x_${i}`,
        type: EdgeType.CONTAINS,
        source: `n_${i}`,
        target: `n_${i + 3}`,
        metadata: {},
        evidence: [],
      });
    }
  }

  return {
    id: `snap_${nodeCount}`,
    createdAt: new Date(),
    identity: {
      sourceId: 'src_bench',
      dirty: false,
      contentFingerprint: `fp_${nodeCount}`,
    },
    source: GraphSource.GRAPHIFY,
    nodes,
    edges,
  };
}

function measureMs(fn: () => void, iterations: number): number[] {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b);
}

describe('AdjacencyIndex benchmark', () => {
  it('reports p50/p95/memory across graph sizes and skips cache by default', () => {
    const sizes = [50, 1_000, 10_000];
    const report: Array<{
      nodes: number;
      edges: number;
      buildP50Ms: number;
      buildP95Ms: number;
      queryBundleP50Ms: number;
      heapUsedMb: number;
    }> = [];

    for (const size of sizes) {
      const snap = syntheticSnapshot(size);
      const buildSamples = measureMs(() => {
        buildAdjacencyIndex(snap);
      }, 25);

      const querySamples = measureMs(() => {
        const mid = `n_${Math.floor(size / 2)}`;
        queryWhoCalls(snap, mid);
        queryDependents(snap, mid);
        queryDependencies(snap, mid);
        queryPath(snap, 'n_0', `n_${Math.min(20, size - 1)}`);
        queryEvidence(snap, mid);
      }, 15);

      const before = process.memoryUsage().heapUsed;
      buildAdjacencyIndex(snap);
      const after = process.memoryUsage().heapUsed;

      report.push({
        nodes: size,
        edges: snap.edges.length,
        buildP50Ms: Number(percentile(buildSamples, 50).toFixed(3)),
        buildP95Ms: Number(percentile(buildSamples, 95).toFixed(3)),
        queryBundleP50Ms: Number(percentile(querySamples, 50).toFixed(3)),
        heapUsedMb: Number(((after - before) / (1024 * 1024)).toFixed(3)),
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      '[AdjacencyIndex bench]',
      JSON.stringify(report, null, 2),
    );

    const tenK = report.find((r) => r.nodes === 10_000);
    expect(tenK).toBeDefined();
    expect(report.every((r) => r.buildP50Ms >= 0)).toBe(true);

    // Product gate for introducing cache: p95 rebuild @10k nodes.
    // Suite uses a loose CI ceiling; report logs the measured decision.
    const PRODUCT_GATE_MS = 50;
    const CI_CEILING_MS = 500;
    const p95 = tenK?.buildP95Ms ?? 0;
    const productWouldOptimize = p95 > PRODUCT_GATE_MS;
    // eslint-disable-next-line no-console
    console.log(
      `[AdjacencyIndex decision] p95@10k=${p95}ms productGate=${PRODUCT_GATE_MS} → ${productWouldOptimize ? 'CONSIDER_OPTIMIZE' : 'NO_CACHE'}`,
    );
    expect(p95).toBeLessThan(CI_CEILING_MS);
  });
});
