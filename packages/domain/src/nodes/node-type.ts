/**
 * Represents the kinds of entities
 * CoreLive can understand.
 *
 * This is the vocabulary of the
 * software knowledge model.
 */
export enum NodeType {
  FILE = 'FILE',
  DIRECTORY = 'DIRECTORY',

  CLASS = 'CLASS',
  FUNCTION = 'FUNCTION',
  METHOD = 'METHOD',
  MODULE = 'MODULE',

  API = 'API',
  EVENT = 'EVENT',

  DATABASE_TABLE = 'DATABASE_TABLE',

  DOCUMENT = 'DOCUMENT',
  ADR = 'ADR',

  TEST = 'TEST',

  SERVICE = 'SERVICE',
  COMPONENT = 'COMPONENT',

  UNKNOWN = 'UNKNOWN'
}