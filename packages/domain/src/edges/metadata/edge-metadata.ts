/**
 * Base metadata shared by every graph relationship.
 */
export interface EdgeMetadata {
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
