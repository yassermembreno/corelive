export interface ApiNodeMetadata {
  method:
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE';

  path: string;

  auth?: 'public' | 'protected';
}
