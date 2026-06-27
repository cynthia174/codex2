import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: false });
  }
}

const hasProxy =
  process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.ALL_PROXY;

const args = [];
if (hasProxy && process.allowedNodeEnvironmentFlags.has('--use-env-proxy')) {
  args.push('--use-env-proxy');
}

args.push('./node_modules/next/dist/bin/next', 'dev', '--turbopack');
args.push(...process.argv.slice(2));

const child = spawn(process.execPath, args, {
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
