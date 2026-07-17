/**
 * Metadata for IMPORTS relationships.
 */
export interface ImportEdgeMetadata {
  isTypeOnly?: boolean;

  moduleSpecifier?: string;

  resolvedPath?: string;
}
