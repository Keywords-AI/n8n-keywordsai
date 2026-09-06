import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function configuration(userFolder = resolve(root, '.local/n8n')) {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    throw new Error('Use Node.js 24 LTS (nvm use) for the pinned n8n runtime.');
  }
  const envFile = resolve(process.env.RESPAN_ENV_FILE || resolve(root, '../respan/.env'));
  const settings = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
  const apiKey = process.env.RESPAN_API_KEY || settings.RESPAN_API_KEY;
  if (!apiKey) throw new Error('Set RESPAN_API_KEY or RESPAN_ENV_FILE (defaults to ../respan/.env).');
  const baseUrl = (process.env.RESPAN_BASE_URL || settings.RESPAN_BASE_URL || 'https://api.respan.ai/api').replace(/\/$/, '');
  mkdirSync(userFolder, { recursive: true, mode: 0o700 });
  const port = process.env.N8N_PORT || '5679';
  const env = {
    ...process.env,
    RESPAN_API_KEY: apiKey,
    RESPAN_BASE_URL: baseUrl,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=@respan/instrumentation-n8n/register`.trim(),
    N8N_USER_FOLDER: userFolder,
    N8N_CUSTOM_EXTENSIONS: resolve(root, 'dist'),
    N8N_HOST: '127.0.0.1',
    N8N_LISTEN_ADDRESS: '127.0.0.1',
    N8N_PORT: port,
    N8N_PROTOCOL: 'http',
    N8N_SECURE_COOKIE: 'false',
    N8N_DIAGNOSTICS_ENABLED: 'false',
    N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
    N8N_TEMPLATES_ENABLED: 'false',
    N8N_PERSONALIZATION_ENABLED: 'false',
    N8N_COMMUNITY_PACKAGES_PREVENT_LOADING: 'true',
    N8N_RUNNERS_BROKER_PORT: process.env.N8N_RUNNERS_BROKER_PORT || String(Number(port) + 1),
    N8N_OTEL_ENABLED: 'true',
    N8N_OTEL_EXPORTER_OTLP_ENDPOINT: baseUrl,
    N8N_OTEL_EXPORTER_OTLP_TRACING_PATH: '/v2/traces',
    N8N_OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Bearer ${apiKey}`,
    N8N_OTEL_TRACES_INCLUDE_NODE_SPANS: 'true',
    N8N_OTEL_TRACES_INJECT_OUTBOUND: 'true',
    N8N_OTEL_TRACES_PRODUCTION_ONLY: 'false',
    N8N_AGENTS_TRACING_ENABLED: 'true',
  };
  return { env, apiKey, baseUrl, port, userFolder };
}

export function startCommand(args, config, onOutput = (value) => process.stdout.write(value)) {
  const child = spawn(process.execPath, [resolve(root, 'node_modules/n8n/bin/n8n'), ...args], {
    cwd: root, env: config.env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Buffer each stream independently so a key split across data events is still redacted.
  for (const stream of [child.stdout, child.stderr]) {
    let pending = '';
    const emit = (value) => onOutput(value.replaceAll(config.apiKey, '[REDACTED]'));
    stream.setEncoding('utf8');
    stream.on('data', (data) => {
      pending += data;
      const newline = pending.lastIndexOf('\n');
      if (newline !== -1) {
        emit(pending.slice(0, newline + 1));
        pending = pending.slice(newline + 1);
      }
    });
    stream.on('end', () => {
      if (pending) emit(pending);
      pending = '';
    });
  }
  const completed = new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolveExit({ code, signal }));
  });
  return { child, completed };
}

export async function stopCommand(running) {
  if (running.child.exitCode !== null || running.child.signalCode !== null) return running.completed;
  running.child.kill('SIGTERM');
  const timer = setTimeout(() => running.child.kill('SIGKILL'), 20000);
  try { return await running.completed; } finally { clearTimeout(timer); }
}
