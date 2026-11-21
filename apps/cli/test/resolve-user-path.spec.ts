import { describe, expect, it } from 'vitest';

import { resolveUserPath } from '../src/resolve-user-path.js';

describe('resolveUserPath', () => {
  it('keeps absolute paths unchanged', () => {
    expect(resolveUserPath('/tmp/repo', {}, '/apps/cli')).toBe('/tmp/repo');
  });

  it('resolves relative paths against INIT_CWD, not package cwd', () => {
    expect(
      resolveUserPath('./mi-repo', { INIT_CWD: '/Users/me/project' }, '/apps/cli'),
    ).toBe('/Users/me/project/mi-repo');
  });

  it('falls back to process cwd when INIT_CWD is absent', () => {
    expect(resolveUserPath('./mi-repo', {}, '/work')).toBe('/work/mi-repo');
  });
});
