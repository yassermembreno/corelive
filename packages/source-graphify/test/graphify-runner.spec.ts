import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  createStdioCapture,
  DefaultGraphifyRunner,
} from '../src/graphify/runner/graphify-runner.js';

const fakeBin = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/fake-graphify.mjs',
);

describe('createStdioCapture', () => {
  it('bounds accumulated bytes and stops appending', () => {
    const capture = createStdioCapture(16);
    capture.append(Buffer.from('abcdefghijklmnop'));
    capture.append(Buffer.from('SHOULD_NOT_APPEAR'));
    expect(capture.bytes).toBe(16);
    expect(capture.truncated).toBe(true);
    expect(capture.text).toBe('abcdefghijklmnop');
    expect(capture.text.includes('SHOULD_NOT')).toBe(false);
  });
});

describe('DefaultGraphifyRunner lifecycle', () => {
  it('returns TIMEOUT and terminates a hung child', async () => {
    const out = await mkdtemp(join(tmpdir(), 'corelive-runner-'));
    const runner = new DefaultGraphifyRunner();
    const previous = process.env.GRAPHIFY_BIN;
    const previousMode = process.env.GRAPHIFY_FAKE_MODE;
    process.env.GRAPHIFY_BIN = fakeBin;
    process.env.GRAPHIFY_FAKE_MODE = 'sleep';

    try {
      const result = await runner.execute({
        repositoryPath: out,
        outputDirectory: out,
        timeoutMs: 200,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('TIMEOUT');
      }
    } finally {
      if (previous === undefined) delete process.env.GRAPHIFY_BIN;
      else process.env.GRAPHIFY_BIN = previous;
      if (previousMode === undefined) delete process.env.GRAPHIFY_FAKE_MODE;
      else process.env.GRAPHIFY_FAKE_MODE = previousMode;
    }
  }, 15_000);

  it('returns CANCELLED when AbortSignal fires', async () => {
    const out = await mkdtemp(join(tmpdir(), 'corelive-runner-'));
    const runner = new DefaultGraphifyRunner();
    const previous = process.env.GRAPHIFY_BIN;
    const previousMode = process.env.GRAPHIFY_FAKE_MODE;
    process.env.GRAPHIFY_BIN = fakeBin;
    process.env.GRAPHIFY_FAKE_MODE = 'sleep';
    const controller = new AbortController();

    try {
      const pending = runner.execute({
        repositoryPath: out,
        outputDirectory: out,
        timeoutMs: 30_000,
        signal: controller.signal,
      });
      setTimeout(() => controller.abort(), 100);
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('CANCELLED');
      }
    } finally {
      if (previous === undefined) delete process.env.GRAPHIFY_BIN;
      else process.env.GRAPHIFY_BIN = previous;
      if (previousMode === undefined) delete process.env.GRAPHIFY_FAKE_MODE;
      else process.env.GRAPHIFY_FAKE_MODE = previousMode;
    }
  }, 15_000);
});
