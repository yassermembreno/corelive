#!/usr/bin/env node
/**
 * Stable CLI entrypoint. Loads TypeScript sources via tsx.
 * Prefer: `pnpm --filter @corelive/cli link --global` then `corelive …`
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = join(here, '../src/cli.ts');

const child = spawn(
  process.execPath,
  ['--import', 'tsx', cliEntry, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env,
    cwd: process.env.INIT_CWD || process.cwd(),
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('Failed to start corelive:', error.message);
  console.error(
    `Tried to load ${pathToFileURL(cliEntry).href} with node --import tsx`,
  );
  process.exit(1);
});
