import { IndexError } from '@corelive/core-engine';

import type { GraphValidator } from '../../contracts/graph-validator.js';
import type { GraphifyEdge } from '../graphify-edge.js';
import type { GraphifyGraph } from '../graphify-graph.js';
import type { GraphifyNode } from '../graphify-node.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new IndexError(
      'EXTERNAL_SCHEMA_INVALID',
      'validate_external',
      `Expected non-empty string at ${path}.${key}`,
    );
  }
  return value;
}

function validateNode(raw: unknown, index: number): GraphifyNode {
  if (!isRecord(raw)) {
    throw new IndexError(
      'EXTERNAL_SCHEMA_INVALID',
      'validate_external',
      `Expected node object at nodes[${index}]`,
    );
  }

  const id = requireString(raw, 'id', `nodes[${index}]`);
  const label = requireString(raw, 'label', `nodes[${index}]`);

  return { ...raw, id, label } as GraphifyNode;
}

function validateEdge(raw: unknown, index: number): GraphifyEdge {
  if (!isRecord(raw)) {
    throw new IndexError(
      'EXTERNAL_SCHEMA_INVALID',
      'validate_external',
      `Expected edge object at edges[${index}]`,
    );
  }

  const source = requireString(raw, 'source', `edges[${index}]`);
  const target = requireString(raw, 'target', `edges[${index}]`);
  const relation = requireString(raw, 'relation', `edges[${index}]`);

  return { ...raw, source, target, relation } as GraphifyEdge;
}

/**
 * Validates and normalizes raw Graphify JSON.
 * Accepts `links` as an alias for `edges`.
 */
export function validateGraphifySchema(input: unknown): GraphifyGraph {
  if (!isRecord(input)) {
    throw new IndexError(
      'EXTERNAL_SCHEMA_INVALID',
      'validate_external',
      'Expected graph object',
    );
  }

  if (!Array.isArray(input.nodes)) {
    throw new IndexError(
      'EXTERNAL_SCHEMA_INVALID',
      'validate_external',
      'Expected nodes array',
    );
  }

  const edgeList = input.edges ?? input.links;
  if (!Array.isArray(edgeList)) {
    throw new IndexError(
      'EXTERNAL_SCHEMA_INVALID',
      'validate_external',
      'Expected edges array',
    );
  }

  const nodes = input.nodes.map(validateNode);
  const edges = edgeList.map(validateEdge);

  return {
    ...input,
    nodes,
    edges,
  } as GraphifyGraph;
}

export class GraphifySchemaValidator implements GraphValidator<GraphifyGraph> {
  async validate(graph: GraphifyGraph): Promise<void> {
    validateGraphifySchema(graph);
  }
}
