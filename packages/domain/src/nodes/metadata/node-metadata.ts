export interface NodeMetadata {
  /**
   * Source that produced this node.
   */
  producer?: string;

  /**
   * Original source file.
   */
  sourceFile?: string;

  /**
   * Original location.
   */
  sourceLocation?: string;

  /**
   * Additional source-specific information.
   */
  attributes?: Record<string, unknown>;
}
