#!/usr/bin/env node
/**
 * Minimal Graphify stand-in for runner lifecycle tests.
 * Modes via GRAPHIFY_FAKE_MODE: sleep | flood | ok
 */
const mode = process.env.GRAPHIFY_FAKE_MODE ?? 'ok';
const args = process.argv.slice(2);

if (args.includes('--version') || args[0] === '--version') {
  process.stdout.write('graphify 0.9.16\n');
  process.exit(0);
}

if (mode === 'sleep') {
  setInterval(() => {}, 1 << 30);
} else if (mode === 'flood') {
  const chunk = Buffer.alloc(64 * 1024, 0x61);
  for (let i = 0; i < 200; i += 1) {
    process.stdout.write(chunk);
  }
  process.exit(0);
} else {
  process.exit(0);
}
