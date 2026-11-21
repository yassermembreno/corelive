/**
 * `pnpm corelive -- <cmd>` forwards a lone `--` immediately after the script
 * path. Commander then treats later flags (e.g. `--type CALLS`) as positionals.
 * Only that leading separator is removed; a later `--` argument is preserved.
 */
export function argvForCommander(argv: string[]): string[] {
  if (argv.length > 2 && argv[2] === '--') {
    return [...argv.slice(0, 2), ...argv.slice(3)];
  }
  return argv;
}
