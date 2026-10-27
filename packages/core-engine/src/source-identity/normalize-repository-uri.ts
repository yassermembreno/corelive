/**
 * Normalize a git remote URL for stable SourceIdentity.sourceId derivation.
 *
 * Strips credentials, .git suffix, and normalizes common ssh forms to a
 * host/path key.
 */
export function normalizeRepositoryUri(raw: string): string {
  let value = raw.trim();

  if (value.startsWith('git@')) {
    const match = /^git@([^:]+):(.+)$/.exec(value);
    if (match) {
      value = `${match[1]}/${match[2]}`;
    }
  } else {
    try {
      const url = new URL(value);
      value = `${url.hostname}${url.pathname}`;
    } catch {
      // Keep non-URL remotes as-is after basic cleanup below.
    }
  }

  value = value.replace(/\\/g, '/');
  value = value.replace(/\/+$/, '');
  value = value.replace(/\.git$/i, '');
  value = value.toLowerCase();

  return value;
}
