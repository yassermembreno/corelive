import type { KnowledgeSnapshot } from '@corelive/domain';
import type { Graph } from './graph.js';

export interface GraphMapper<TGraph extends Graph> {

  map(graph: TGraph): KnowledgeSnapshot;

}