import { resolve, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { IndexError } from '@corelive/core-engine';
import { describe, expect, it } from 'vitest';

import { validateGraphifySchema } from '../src/graphify/validation/graphify-schema-validator.js';

const fixture = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './fixtures/graphify-captured/graph.json',
);

describe('GraphifySchemaValidator', () => {
  it('validates the captured fixture', async () => {
    const raw = JSON.parse(await readFile(fixture, 'utf-8'));
    const graph = validateGraphifySchema(raw);

    expect(graph.nodes).toHaveLength(11);
    expect(graph.edges).toHaveLength(12);
  });

  it('accepts links as an alias for edges', () => {
    const graph = validateGraphifySchema({
      nodes: [{ id: 'a', label: 'A' }],
      links: [{ source: 'a', target: 'a', relation: 'contains' }],
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.relation).toBe('contains');
  });

  it('fails when nodes array is missing', () => {
    expect(() => validateGraphifySchema({ edges: [] })).toThrow(IndexError);
    try {
      validateGraphifySchema({ edges: [] });
    } catch (error) {
      expect(error).toBeInstanceOf(IndexError);
      expect((error as IndexError).failure).toBe('EXTERNAL_SCHEMA_INVALID');
    }
  });
});
