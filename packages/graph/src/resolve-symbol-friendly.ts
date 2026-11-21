import type { GraphNode, KnowledgeSnapshot } from '@corelive/domain';

import {
  resolveSymbol,
  type ResolveSymbolResult,
  type SymbolCandidate,
} from './resolve-symbol.js';

/**
 * Deterministic expansions for friendlier CLI input (not fuzzy search).
 * Order: as-is, `.${input}`, `${input}()`, `.${input}()`.
 */
export function symbolExpansions(symbol: string): string[] {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return [];
  }

  const expansions = [
    trimmed,
    `.${trimmed}`,
    `${trimmed}()`,
    `.${trimmed}()`,
  ];

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of expansions) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

/**
 * Exact resolve first; if not found, try Graphify-style expansions.
 * Multiple distinct matches → ambiguous (candidates sorted by id).
 */
export function resolveSymbolFriendly(
  snapshot: KnowledgeSnapshot,
  symbol: string,
): ResolveSymbolResult {
  const exact = resolveSymbol(snapshot, symbol);
  if (exact.status !== 'not_found') {
    return exact;
  }

  const matches = new Map<string, GraphNode>();
  for (const candidate of symbolExpansions(symbol)) {
    if (candidate === symbol) {
      continue;
    }
    const result = resolveSymbol(snapshot, candidate);
    if (result.status === 'found') {
      matches.set(result.node.id, result.node);
    } else if (result.status === 'ambiguous') {
      for (const c of result.candidates) {
        const node = snapshot.nodes.find((n) => n.id === c.id);
        if (node) {
          matches.set(node.id, node);
        }
      }
    }
  }

  if (matches.size === 1) {
    return { status: 'found', node: [...matches.values()][0]! };
  }

  if (matches.size > 1) {
    const candidates: SymbolCandidate[] = [...matches.values()]
      .map((node) => ({
        id: node.id,
        name: node.name,
        location: node.location,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { status: 'ambiguous', candidates };
  }

  return { status: 'not_found' };
}
