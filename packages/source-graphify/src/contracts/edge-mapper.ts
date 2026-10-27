import type { GraphEdge } from '@corelive/domain';

export interface EdgeMapper<TSource> {

  map(edge: TSource): GraphEdge;
}