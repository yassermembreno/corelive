import { access, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';

import { err, ok, type Result } from '@corelive/core-engine';

import {
  assertCompatibleGraphifyVersion,
  buildGraphifyExtractArgv,
  GRAPHIFYY_PIN,
  resolveGraphifyGraphJsonPath,
} from '../boundary/index.js';

export type GraphifyExecutionFailure =
  | 'TOOL_NOT_FOUND'
  | 'INCOMPATIBLE_VERSION'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'EXTRACTION_FAILED'
  | 'OUTPUT_MISSING'
  | 'OUTPUT_TOO_LARGE';

export interface GraphifyExecution {
  toolVersion: string;
  outputDirectory: string;
  durationMs: number;
  exitCode: number;
  graphJsonPath: string;
}

export interface GraphifyRunner {
  execute(request: {
    repositoryPath: string;
    outputDirectory: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<Result<GraphifyExecution, GraphifyExecutionFailure>>;
}

const STRIPPED_ENV_KEYS = [
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'MOONSHOT_API_KEY',
  'DEEPSEEK_API_KEY',
] as const;

const DEFAULT_OUTPUT_MAX_BYTES = 512 * 1024 * 1024;

function resolveGraphifyBin(): string {
  return process.env.GRAPHIFY_BIN?.trim() || 'graphify';
}

function sanitizeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of STRIPPED_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

function spawnAsync(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    detached?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string; pid?: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: options.detached,
      signal: options.signal,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(Object.assign(new Error('TOOL_NOT_FOUND'), { code: 'ENOENT' }));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        pid: child.pid,
      });
    });
  });
}

async function readGraphifyVersion(
  bin: string,
): Promise<Result<string, GraphifyExecutionFailure>> {
  try {
    const result = await spawnAsync(bin, ['--version'], {
      env: sanitizeEnv(),
    });

    if (result.exitCode !== 0) {
      return err('EXTRACTION_FAILED');
    }

    const version = result.stdout.trim() || result.stderr.trim();
    if (!version) {
      return err('EXTRACTION_FAILED');
    }

    return ok(version);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return err('TOOL_NOT_FOUND');
    }
    return err('EXTRACTION_FAILED');
  }
}

function killProcessGroup(pid: number): void {
  if (process.platform === 'win32') {
    process.kill(pid);
    return;
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process already exited.
    }
  }
}

export class DefaultGraphifyRunner implements GraphifyRunner {
  constructor(
    private readonly outputMaxBytes: number = DEFAULT_OUTPUT_MAX_BYTES,
  ) {}

  async execute(request: {
    repositoryPath: string;
    outputDirectory: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<Result<GraphifyExecution, GraphifyExecutionFailure>> {
    if (request.signal?.aborted) {
      return err('CANCELLED');
    }

    const bin = resolveGraphifyBin();
    const versionResult = await readGraphifyVersion(bin);
    if (!versionResult.ok) {
      return versionResult;
    }

    const toolVersion = versionResult.value;
    if (!assertCompatibleGraphifyVersion(toolVersion)) {
      return err('INCOMPATIBLE_VERSION');
    }

    const argv = buildGraphifyExtractArgv({
      repositoryPath: request.repositoryPath,
      outputDirectory: request.outputDirectory,
    });

    const startedAt = Date.now();
    const detached = process.platform !== 'win32';

    try {
      const result = await new Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
        pid?: number;
        timedOut?: boolean;
        cancelled?: boolean;
      }>((resolve, reject) => {
        const child = spawn(bin, argv, {
          env: sanitizeEnv(),
          stdio: ['ignore', 'pipe', 'pipe'],
          detached,
          signal: request.signal,
        });

        let stdout = '';
        let stderr = '';
        let settled = false;

        const finish = (
          value: {
            exitCode: number;
            stdout: string;
            stderr: string;
            pid?: number;
            timedOut?: boolean;
            cancelled?: boolean;
          },
        ) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(value);
        };

        let timeoutHandle: NodeJS.Timeout | undefined;
        if (request.timeoutMs !== undefined && request.timeoutMs > 0) {
          timeoutHandle = setTimeout(() => {
            if (child.pid !== undefined) {
              killProcessGroup(child.pid);
            }
            finish({
              exitCode: 1,
              stdout,
              stderr,
              pid: child.pid,
              timedOut: true,
            });
          }, request.timeoutMs);
        }

        const onAbort = () => {
          if (child.pid !== undefined) {
            killProcessGroup(child.pid);
          }
          finish({
            exitCode: 1,
            stdout,
            stderr,
            pid: child.pid,
            cancelled: true,
          });
        };

        request.signal?.addEventListener('abort', onAbort, { once: true });

        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8');
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8');
        });

        child.on('error', (error) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          request.signal?.removeEventListener('abort', onAbort);
          reject(error);
        });

        child.on('close', (code) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          request.signal?.removeEventListener('abort', onAbort);
          finish({
            exitCode: code ?? 1,
            stdout,
            stderr,
            pid: child.pid,
          });
        });
      });

      const durationMs = Date.now() - startedAt;

      if (result.cancelled || request.signal?.aborted) {
        return err('CANCELLED');
      }

      if (result.timedOut) {
        return err('TIMEOUT');
      }

      if (result.exitCode !== 0) {
        return err('EXTRACTION_FAILED');
      }

      const graphJsonPath = resolveGraphifyGraphJsonPath(
        request.outputDirectory,
      );

      try {
        await access(graphJsonPath, constants.R_OK);
      } catch {
        return err('OUTPUT_MISSING');
      }

      const fileStat = await stat(graphJsonPath);
      if (fileStat.size > this.outputMaxBytes) {
        return err('OUTPUT_TOO_LARGE');
      }

      return ok({
        toolVersion: toolVersion.replace(/^graphify\s+/i, '') || GRAPHIFYY_PIN,
        outputDirectory: request.outputDirectory,
        durationMs,
        exitCode: result.exitCode,
        graphJsonPath,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return err('TOOL_NOT_FOUND');
      }
      return err('EXTRACTION_FAILED');
    }
  }
}
