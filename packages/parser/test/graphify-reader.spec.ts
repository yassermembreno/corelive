import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GraphifyReader } from '../src/graphify/graphify-reader.js';

const fixture = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './fixtures/graphify-small.json'
);

describe('GraphifyReader', () => {
  it('should read a graphify json file', async () => {
    const reader = new GraphifyReader();

    const graph = await reader.read(fixture);

    console.log(JSON.stringify(graph, null, 2));
    expect(graph).toBeDefined();

    expect(graph.nodes).toHaveLength(2);

    expect(graph.edges).toHaveLength(1);

    expect(graph.nodes[0]?.label).toBe('PublicController');

    expect(graph.edges[0]?.relation).toBe('calls');
  });
});
