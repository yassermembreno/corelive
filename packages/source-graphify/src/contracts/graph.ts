export interface Graph<TNode = unknown, TEdge = unknown> {
  nodes: readonly TNode[];
  edges: readonly TEdge[];
}
