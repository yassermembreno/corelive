/**
 * Frozen Graphify tool pin for CoreLive Phase 0.
 *
 * Verified with a real `graphify extract --code-only --no-cluster` run.
 * `setup` installs this exact version; `index` refuses any other.
 */
export const GRAPHIFYY_PACKAGE = 'graphifyy' as const;

export const GRAPHIFYY_PIN = '0.9.16' as const;

export const GRAPHIFY_EXTRACTOR = 'graphify' as const;

/** Canonical CoreLive schema version that this Graphify pin maps into. */
export const CANONICAL_SCHEMA_VERSION = '1' as const;
