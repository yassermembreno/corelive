import type { GraphNode } from '@corelive/domain';

export interface NodeMapper<TSource> {

  map(node: TSource): GraphNode;

}