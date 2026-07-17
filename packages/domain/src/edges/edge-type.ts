/**
 * Represents relationships
 * between entities in the knowledge graph.
 */
export enum EdgeType {

  CONTAINS = 'CONTAINS',

  IMPORTS = 'IMPORTS',

  CALLS = 'CALLS',

  REFERENCES = 'REFERENCES',

  IMPLEMENTS = 'IMPLEMENTS',

  EXTENDS = 'EXTENDS',

  DEPENDS_ON = 'DEPENDS_ON',

  DOCUMENTED_BY = 'DOCUMENTED_BY',

  TESTED_BY = 'TESTED_BY',

  MODIFIED_BY = 'MODIFIED_BY',

  RELATED_TO = 'RELATED_TO'
}