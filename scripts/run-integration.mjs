import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, appendFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { parse as parseFlatted } from 'flatted';
import { root, configuration, startCommand, stopCommand } from './runtime.mjs';

const runId = `respan-n8n-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const runDir = resolve(root, '.local/runs', runId);
mkdirSync(runDir, { recursive: true, mode: 0o700 });
const config = configuration(resolve(runDir, 'state'));
const origin = `http://127.0.0.1:${config.port}`;
const evidence = { run_id: runId, started_at: new Date().toISOString(), n8n_version: '2.37.7', scenarios: [] };
const log = (value) => appendFileSync(resolve(runDir, 'n8n.log'), value, { mode: 0o600 });
const credentialId = 'respanMigrationKey';
let server;

function saveEvidence() {
  writeFileSync(resolve(runDir, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
}

function recordFailure(error) {
  const message = String(error?.message || error).replaceAll(config.apiKey, '[REDACTED]');
  evidence.error = evidence.error ? `${evidence.error}; ${message}` : message;
  process.exitCode = 1;
  console.error(message);
}

async function command(args, successPattern) {
  let output = '';
  const running = startCommand(args, config, (value) => { output += value; log(value); });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    // The same completion promise below reports spawn errors; this handler prevents
    // a second unhandled rejection while stopCommand applies its SIGKILL deadline.
    void stopCommand(running).catch(() => {});
  }, 90000);
  let result;
  try { result = await running.completed; } finally { clearTimeout(timer); }
  // n8n import commands can catch errors without setting a nonzero exit status.
  if (timedOut || result.code !== 0 || (successPattern && !successPattern.test(output))) {
    throw new Error(`${args[0]} ${timedOut ? 'timed out' : 'failed'}; see ${resolve(runDir, 'n8n.log')}`);
  }
}

function selectFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(value, field)).map((field) => [field, value[field]]));
}

function publicCompletion(completion) {
  const result = selectFields(completion, ['id', 'created', 'model', 'object', 'choices', 'usage', 'service_tier']);
  if (completion?.request_breakdown && typeof completion.request_breakdown === 'object') {
    // The Gateway breakdown can contain server-side credentials. Save only public evidence.
    result.request_breakdown = selectFields(completion.request_breakdown, [
      'unique_id', 'cost', 'status_code', 'status', 'metadata', 'model',
      'prompt_tokens', 'completion_tokens', 'total_request_tokens',
    ]);
  }
  return result;
}

function verifyInvalidMetadataExecution() {
  const scenario = evidence.scenarios.find((item) => item.scenario === 'invalid-metadata');
  if (!scenario) return;
  let database;
  try {
    database = new DatabaseSync(resolve(config.userFolder, '.n8n/database.sqlite'), { readOnly: true });
    const rows = database.prepare(`
      SELECT e.id, e.status, d.data FROM execution_entity e
      JOIN execution_data d ON d.executionId = e.id WHERE e.workflowId = ?
    `).all(scenario.workflow_id);
    assert.equal(rows.length, 1, 'Expected one isolated invalid-metadata execution');
    const row = rows[0];
    const result = parseFlatted(row.data).resultData;
    const nodeRun = result?.runData?.['Respan Gateway']?.[0];
    assert.equal(row.status, 'error', 'Invalid metadata execution must have error status');
    assert.ok(result?.error?.name === 'NodeOperationError', 'Invalid metadata must produce NodeOperationError');
    assert.ok(result.error.message === 'Metadata must be a JSON object', 'Invalid metadata must fail with the expected field validation message');
    assert.ok(result.error.node?.name === 'Respan Gateway', 'Invalid metadata must fail in the Respan Gateway node');
    assert.ok(result.lastNodeExecuted === 'Respan Gateway', 'Respan Gateway must be the last executed node');
    assert.ok(result.runData.Webhook?.[0]?.executionStatus === 'success', 'The invalid-metadata webhook must execute successfully');
    assert.ok(nodeRun?.executionStatus === 'error' && nodeRun.error?.name === 'NodeOperationError'
      && nodeRun.error.message === 'Metadata must be a JSON object', 'The Respan Gateway node must record the expected metadata validation failure');
    // Never serialize execution_data: other workflow executions may contain private response fields.
    scenario.database_check = 'PASS';
    scenario.execution_check = 'PASS';
    scenario.execution_id = row.id;
    scenario.execution_status = row.status;
    scenario.expected_error = { name: result.error.name, message: result.error.message, node: result.error.node.name };
  } catch (error) {
    scenario.database_check = 'FAIL';
    scenario.execution_check = 'FAIL';
    throw error;
  } finally {
    database?.close();
  }
}

async function assertFreePort() {
  const socket = createServer();
  await new Promise((resolveReady, reject) => {
    socket.once('error', reject);
    socket.listen(Number(config.port), '127.0.0.1', resolveReady);
  });
  await new Promise((resolveClosed) => socket.close(resolveClosed));
}

function workflow(scenario, invalid = false) {
  const id = `respan${randomBytes(5).toString('hex')}`;
  const path = `${runId}/${scenario}`;
  return {
    id, name: `${runId}-${scenario}`, active: false, versionId: randomUUID(),
    settings: { executionOrder: 'v1', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' },
    nodes: [
      { id: randomUUID(), name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2,
        position: [0, 0], webhookId: randomUUID(), parameters: { httpMethod: 'POST', path, responseMode: 'lastNode', options: {} } },
      { id: randomUUID(), name: 'Respan Gateway', type: 'CUSTOM.keywordsAi', typeVersion: 1,
        position: [260, 0], credentials: { keywordsAIApi: { id: credentialId, name: 'Respan local integration' } },
        parameters: { resource: 'gateway', model: process.env.RESPAN_MODEL || 'gpt-4o-mini',
          systemMessage: 'Follow the user instruction exactly.',
          messages: { messageValues: [{ role: 'user', content: `Reply exactly with ${runId}` }] },
          additionalFields: { metadata: invalid ? '[]' : JSON.stringify({ run_id: runId, scenario }),
            customIdentifier: `${runId}-${scenario}`, requestBreakdown: true,
            overrideParamsJson: JSON.stringify({ max_tokens: 64, temperature: 0 }) } } },
    ],
    connections: { Webhook: { main: [[{ node: 'Respan Gateway', type: 'main', index: 0 }]] } },
  };
}

try {
  await assertFreePort();
  const credentialFile = resolve(runDir, 'credentials.json');
  writeFileSync(credentialFile, JSON.stringify([{ id: credentialId, name: 'Respan local integration',
    type: 'keywordsAIApi', data: { apiKey: config.apiKey } }]), { mode: 0o600 });
  console.log('Importing the credential into the isolated n8n database.');
  try { await command(['import:credentials', `--input=${credentialFile}`], /Successfully imported 1 credential/); }
  finally { unlinkSync(credentialFile); }

  const workflows = [workflow('gateway'), workflow('invalid-metadata', true)];
  const workflowFile = resolve(runDir, 'workflows.json');
  writeFileSync(workflowFile, JSON.stringify(workflows, null, 2) + '\n');
  await command(['import:workflow', `--input=${workflowFile}`], /Successfully imported 2 workflows/);
  for (const item of workflows) await command(['publish:workflow', `--id=${item.id}`], /Please restart n8n/);

  console.log('Starting n8n with the local Respan instrumentation preload.');
  server = startCommand(['start'], config, log);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.child.exitCode !== null) throw new Error(`n8n exited; see ${resolve(runDir, 'n8n.log')}`);
    try { ready = (await fetch(`${origin}/healthz/readiness`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await delay(500);
  }
  if (!ready) throw new Error(`n8n did not become ready; see ${resolve(runDir, 'n8n.log')}`);

  for (const [index, item] of workflows.entries()) {
    const scenario = index === 0 ? 'gateway' : 'invalid-metadata';
    const traceId = randomBytes(16).toString('hex');
    const upstreamParentId = randomBytes(8).toString('hex');
    const result = { scenario, workflow_id: item.id, workflow_name: item.name, trace_id: traceId, upstream_parent_id: upstreamParentId };
    evidence.scenarios.push(result);
    saveEvidence();
    console.log(`Executing ${scenario}; trace ${traceId}`);
    const response = await fetch(`${origin}/webhook/${item.nodes[0].parameters.path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', traceparent: `00-${traceId}-${upstreamParentId}-01` },
      body: JSON.stringify({ run_id: runId }), signal: AbortSignal.timeout(90000),
    });
    result.http_status = response.status;
    const body = await response.json();
    const completion = Array.isArray(body) ? body[0] : body;
    const savedResponse = index === 0 ? publicCompletion(completion) : body;
    writeFileSync(resolve(runDir, `${scenario}-response.json`), JSON.stringify(savedResponse, null, 2).replaceAll(config.apiKey, '[REDACTED]') + '\n', { mode: 0o600 });
    if (index === 0) {
      assert.equal(response.status, 200, 'Gateway workflow must succeed');
      assert.equal(completion.choices?.[0]?.message?.content?.trim(), runId, 'Must return the exact live-provider marker');
      assert.ok(completion.usage?.total_tokens > 0, 'Provider usage must be present');
      assert.ok(typeof completion.request_breakdown?.unique_id === 'string' && completion.request_breakdown.unique_id,
        'Gateway response must include a request log ID');
      result.model = completion.model;
      result.usage = completion.usage;
      result.completion_id = completion.id;
      result.gateway_log_id = completion.request_breakdown.unique_id;
      result.execution_check = 'PASS';
    } else {
      assert.ok(response.status >= 400, 'Invalid metadata workflow must return an error');
      result.execution_check = 'PENDING_DATABASE_REVIEW';
    }
    result.platform_check = 'PENDING_MCP_REVIEW';
    saveEvidence();
  }
} catch (error) {
  recordFailure(error);
} finally {
  try {
    if (server) {
      console.log('Stopping n8n and flushing its native exporter.');
      evidence.shutdown = await stopCommand(server);
      assert.equal(evidence.shutdown.code, 0, 'n8n must shut down cleanly');
      verifyInvalidMetadataExecution();
    }
  } catch (error) {
    recordFailure(error);
  }
  evidence.finished_at = new Date().toISOString();
  saveEvidence();
  console.log(`Evidence: ${resolve(runDir, 'evidence.json')}`);
}
