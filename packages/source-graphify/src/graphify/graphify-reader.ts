import { readFile } from 'node:fs/promises';

import type { GraphReader } from '../contracts/graph-reader.js';
import type { GraphifyGraph } from './graphify-graph.js';


export class GraphifyReader
  implements GraphReader<GraphifyGraph> {

  async read(source: string): Promise<GraphifyGraph> {

    const content = await readFile(
      source,
      'utf-8'
    );

    return JSON.parse(content) as GraphifyGraph;
  }

}