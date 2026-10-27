/**
 * Base metadata shared by every graph relationship.
 */
export interface EdgeMetadata {
  /**
   * Original relation string from the external extractor.
   */
  sourceRelation?: string;

  /**
   * Confidence assigned by the parser.
   *
   * Range: 0.0 - 1.0
   */
  confidence?: number;

  /**
   * Language/plugin that produced the edge.
   *
   * Examples:
   *  - typescript
   *  - java
   *  - python
   */
  producer?: string;
}
