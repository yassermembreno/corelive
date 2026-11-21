import { isAbsolute, resolve } from 'node:path';

/**
 * Resolve a user-supplied path against the directory where the user invoked
 * the CLI (`INIT_CWD` from pnpm, else `process.cwd()`).
 */
export function resolveUserPath(
  input: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  if (isAbsolute(input)) {
    return input;
  }
  const base = env.INIT_CWD?.trim() || cwd;
  return resolve(base, input);
}
