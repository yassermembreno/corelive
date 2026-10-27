export interface NodeMetadata {
  /**
   * Original type string from the external extractor.
   */
  sourceType?: string;

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
