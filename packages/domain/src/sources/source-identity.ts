export interface SourceIdentity {
  sourceId: string;
  repositoryUri?: string;
  commitSha?: string;
  dirty: boolean;
  contentFingerprint: string;
}
