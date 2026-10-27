import { describe, expect, it } from 'vitest';

import {
  assertCompatibleGraphifyVersion,
  buildGraphifyExtractArgv,
  GRAPHIFYY_PIN,
  resolveGraphifyGraphJsonPath,
} from '../src/graphify/boundary/index.js';

describe('graphify boundary', () => {
  it('pins the verified graphifyy version', () => {
    expect(GRAPHIFYY_PIN).toBe('0.9.16');
    expect(assertCompatibleGraphifyVersion('graphify 0.9.16')).toBe(true);
    expect(assertCompatibleGraphifyVersion('0.10.0')).toBe(false);
  });

  it('builds the frozen extract argv without --no-viz', () => {
    const argv = buildGraphifyExtractArgv({
      repositoryPath: '/repo',
      outputDirectory: '/corelive/out',
    });

    expect(argv).toEqual([
      'extract',
      '/repo',
      '--code-only',
      '--no-cluster',
      '--out',
      '/corelive/out',
    ]);
    expect(argv).not.toContain('--no-viz');
  });

  it('resolves graph.json under graphify-out/', () => {
    expect(resolveGraphifyGraphJsonPath('/tmp/out')).toBe(
      '/tmp/out/graphify-out/graph.json',
    );
  });
});
