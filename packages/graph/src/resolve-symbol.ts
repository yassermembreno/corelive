import type { GraphNode, KnowledgeSnapshot, NodeLocation } from '@corelive/domain';

export type SymbolCandidate = {
  id: string;
  name: string;
  location: NodeLocation;
};

export type ResolveSymbolResult =
  | { status: 'found'; node: GraphNode }
  | { status: 'not_found' }
  | { status: 'ambiguous'; candidates: SymbolCandidate[] };

/**
 * Exact `node.id`, then exact `node.name` (case-sensitive).
 * Ambiguous names return candidates sorted by id.
 */
export function resolveSymbol(
  snapshot: KnowledgeSnapshot,
  symbol: string,
): ResolveSymbolResult {
  const byId = snapshot.nodes.find((node) => node.id === symbol);
  if (byId) {
    return { status: 'found', node: byId };
  }

  const byName = snapshot.nodes.filter((node) => node.name === symbol);
  if (byName.length === 1) {
    return { status: 'found', node: byName[0]! };
  }
  if (byName.length > 1) {
    const candidates = byName
      .map(
        (node): SymbolCandidate => ({
          id: node.id,
          name: node.name,
          location: node.location,
        }),
      )
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { status: 'ambiguous', candidates };
  }

  return { status: 'not_found' };
}
