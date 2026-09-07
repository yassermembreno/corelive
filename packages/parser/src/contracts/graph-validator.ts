import type { Graph } from './graph.js';

export interface GraphValidator<TGraph extends Graph> {
  validate(graph: TGraph): Promise<void>;
}
