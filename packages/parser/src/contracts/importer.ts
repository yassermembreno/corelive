import type { KnowledgeSnapshot } from '@corelive/domain';

export interface Importer {

  import(source: string): Promise<KnowledgeSnapshot>;

}