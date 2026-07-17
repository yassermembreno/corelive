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
