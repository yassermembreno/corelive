import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EdgeType, GraphSource, NodeType } from '@corelive/domain';
import { describe, expect, it } from 'vitest';

import { GraphifyReader } from '../src/graphify/graphify-reader.js';
import { mapGraphifyGraphToSnapshot } from '../src/graphify/mapping/graph-mapper.js';
import { validateGraphifySchema } from '../src/graphify/validation/graphify-schema-validator.js';

const fixture = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './fixtures/graphify-captured/graph.json',
);

const fakeIdentity = {
  sourceId: 'src_test',
  contentFingerprint: 'fp_test',
  dirty: false,
};

describe('graphify mappers', () => {
  it('maps captured graph.json into a canonical snapshot', async () => {
    const reader = new GraphifyReader();
    const raw = await reader.read(fixture);
    const graph = validateGraphifySchema(raw);
    const snapshot = mapGraphifyGraphToSnapshot(graph, fakeIdentity);

    expect(snapshot.source).toBe(GraphSource.GRAPHIFY);
    expect(snapshot.identity).toBe(fakeIdentity);
    expect(snapshot.nodes.every((node) => node.id.startsWith('graphify:'))).toBe(
      true,
    );

    const publicController = snapshot.nodes.find(
      (node) => node.name === 'PublicController',
    );
    expect(publicController?.type).toBe(NodeType.CLASS);
    expect(publicController?.id).toBe(
      'graphify:users_yasse_rmembreno_dev_corelive_packages_parser_test_fixtures_mini_repo_src_controller_publiccontroller',
    );

    const callsEdge = snapshot.edges.find((edge) => edge.type === EdgeType.CALLS);
    expect(callsEdge).toBeDefined();
    expect(callsEdge?.metadata).toMatchObject({ sourceRelation: 'calls' });
    expect(callsEdge?.source).toContain('graphify:');
    expect(callsEdge?.target).toContain('graphify:');
  });
});
