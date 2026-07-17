import type { Graph } from './graph.js';

export interface GraphReader<TGraph extends Graph> {
  read(source: string): Promise<TGraph>;
}
