import { describe, expect, it } from 'vitest';

import { argvForCommander } from '../src/argv-for-commander.js';

describe('argvForCommander', () => {
  it('strips the pnpm-injected -- after the script path', () => {
    expect(
      argvForCommander([
        'node',
        'cli.ts',
        '--',
        'query',
        'dependents',
        '.reserve()',
        '--type',
        'CALLS',
      ]),
    ).toEqual([
      'node',
      'cli.ts',
      'query',
      'dependents',
      '.reserve()',
      '--type',
      'CALLS',
    ]);
  });

  it('preserves a later -- argument', () => {
    expect(
      argvForCommander(['node', 'cli.ts', 'query', 'who-calls', '--']),
    ).toEqual(['node', 'cli.ts', 'query', 'who-calls', '--']);
  });

  it('is a no-op when no separator is present', () => {
    expect(
      argvForCommander(['node', 'cli.ts', 'query', 'who-calls', 'reserve']),
    ).toEqual(['node', 'cli.ts', 'query', 'who-calls', 'reserve']);
  });
});
