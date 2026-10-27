import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GraphifyReader } from '../src/graphify/graphify-reader.js';

const fixture = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './fixtures/graphify-captured/graph.json',
);

describe('GraphifyReader', () => {
  it('reads a captured graphify extract graph.json', async () => {
    const reader = new GraphifyReader();
    const graph = await reader.read(fixture);

    expect(graph.nodes).toHaveLength(11);
    expect(graph.edges).toHaveLength(12);
    expect(graph.nodes.some((n) => n.label === 'PublicController')).toBe(true);
    expect(graph.edges.some((e) => e.relation === 'calls')).toBe(true);
    expect(graph).not.toHaveProperty('directed');
  });
});
