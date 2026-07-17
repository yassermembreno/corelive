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

export interface CodeNodeMetadata {

    language?: string;

    exported?: boolean;

    visibility?:
      | 'public'
      | 'private'
      | 'protected';


    async?: boolean;

    abstract?: boolean;

}

export interface ApiNodeMetadata {

  method:
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE';

  path:string;

  auth?: 'public' | 'protected';

}

export interface DatabaseNodeMetadata {

  /**
   * Database engine.
   *
   * Examples:
   * - postgresql
   * - mysql
   * - mongodb
   */
  engine?: string;


  /**
   * Database object type.
   */
  objectType?:
    | 'table'
    | 'view'
    | 'collection'
    | 'index';


  /**
   * Schema name.
   *
   * Example:
   * public
   */
  schema?: string;


  /**
   * Persistence technology.
   *
   * Example:
   * typeorm
   * prisma
   * sequelize
   */
  orm?: string;


  /**
   * Extra database properties.
   */
  columns?: number;

}

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