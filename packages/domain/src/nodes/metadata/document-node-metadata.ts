export interface DocumentNodeMetadata {
  /**
   * Document format.
   */
  format?:
    | 'markdown'
    | 'pdf'
    | 'html'
    | 'text';

  /**
   * Document category.
   */
  documentType?:
    | 'ADR'
    | 'README'
    | 'RFC'
    | 'GUIDE'
    | 'SPEC';

  /**
   * Document status.
   */
  status?:
    | 'draft'
    | 'proposed'
    | 'accepted'
    | 'deprecated';

  /**
   * Version if applicable.
   */
  version?: string;

  /**
   * Extracted sections.
   */
  sections?: string[];
}
