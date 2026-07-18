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