# Install and run locally

This setup runs the Respan community node on n8n `2.37.7` and loads `@respan/instrumentation-n8n` from a sibling Respan checkout. Use Node.js **24** for every installation, build, and launch command. The repository's `.nvmrc` selects Node 24, and its launch scripts reject other major versions.

These instructions apply to the migrated source on this branch. The instrumentation is linked from source until a compatible npm release is available.

## 1. Prepare the sibling checkouts

Use this directory layout; the `file:../respan/...` dependencies rely on it:

```text
your-workspace/
├── n8n-keywordsai/
└── respan/
```

If either repository is missing, clone it from your workspace directory:

```bash
git clone https://github.com/respanai/n8n-keywordsai.git
git clone --branch feat/instrumentation-n8n-javascript \
  https://github.com/Nightingalelyy/respan.git respan
```

For an existing Respan checkout, inspect its work before selecting the branch:

```bash
cd respan
git status --short
git worktree list
git switch feat/instrumentation-n8n-javascript
cd ../n8n-keywordsai
```

Preserve unrelated edits before switching. If Git reports that another worktree owns the branch, resolve that checkout arrangement before proceeding; the `respan` sibling must contain the n8n instrumentation source.

Select Node 24 from the migrated `n8n-keywordsai` checkout:

```bash
nvm install 24
nvm use
node --version
```

If you use another runtime manager, select Node 24 there instead. You also need Git, npm, network access for dependency installation, and a Respan API key. The live Gateway example requires provider access for the selected model on that Respan account.

## 2. Build the Respan packages

For a fresh checkout, install the Respan workspace dependencies and build the three packages in order. Run these commands from `n8n-keywordsai`:

```bash
cd ../respan/javascript-sdks
npx --yes @yarnpkg/cli-dist@4.9.2 install
npx --yes @yarnpkg/cli-dist@4.9.2 workspace @respan/respan-sdk build
npx --yes @yarnpkg/cli-dist@4.9.2 workspace @respan/tracing build
npx --yes @yarnpkg/cli-dist@4.9.2 workspace @respan/instrumentation-n8n build
cd ../../n8n-keywordsai
```

An existing workspace can have installed dependencies but stale Yarn workspace state after a branch switch. If Yarn reports that a workspace is missing from the lockfile, the already installed TypeScript compiler can build these packages directly:

```bash
cd ../respan/javascript-sdks
node node_modules/typescript/bin/tsc -p respan-sdk/tsconfig.json
node node_modules/typescript/bin/tsc -p respan-tracing/tsconfig.json
node node_modules/typescript/bin/tsc \
  -p instrumentations/respan-instrumentation-n8n/tsconfig.json
cd ../../n8n-keywordsai
```

This is the fallback used for the validated local setup. It requires the workspace's dependencies to be installed already; it does not replace the Yarn install step for a fresh checkout. See [VALIDATION.md](VALIDATION.md) for the tested versions.

## 3. Install and build the community node

From `n8n-keywordsai`:

```bash
npm ci
npm run build
```

The repository's lockfile pins n8n to `2.37.7`. Keep `.npmrc` in place: `install-links=false` preserves local links to all three Respan packages, and `legacy-peer-deps=true` matches the locked dependency graph for n8n's conflicting optional peers. Install development dependencies; they contain the local n8n runtime and instrumentation.

Check the installed versions and links without starting n8n:

```bash
npm ls --depth=0 n8n @respan/instrumentation-n8n @respan/tracing @respan/respan-sdk
```

The Respan entries should point into `../respan/javascript-sdks`. These steps use the local instrumentation source and require no global package linking. Rebuild the relevant Respan packages after editing them, rebuild this node after editing it, and restart n8n to load the changes.

## 4. Configure the Respan key

By default, the launcher reads `RESPAN_API_KEY` from `../respan/.env`. If that file already contains your key, no additional configuration is needed. For another dotenv file:

```bash
RESPAN_ENV_FILE=/absolute/path/to/respan.env npm start
```

The launcher parses the file as data and reads only `RESPAN_API_KEY` and `RESPAN_BASE_URL`. An existing process environment value takes precedence for either setting. Do not source the file into your shell. Set other options in the process environment, such as the inline examples below.

| Variable | Default | Effect |
| --- | --- | --- |
| `RESPAN_API_KEY` | Key in the selected dotenv file | Authenticates native trace export. The integration runner also imports it as an n8n credential for its Gateway workflow. |
| `RESPAN_ENV_FILE` | `../respan/.env`, resolved from the repository | Chooses the dotenv file. An explicit relative path is resolved from the command's working directory. |
| `RESPAN_BASE_URL` | `https://api.respan.ai/api` | Sets the trace export API base; the launcher appends `/v2/traces`. It does not change this community node's Gateway or prompt API host. |
| `RESPAN_MODEL` | `gpt-4o-mini` | Sets the model for `npm run integration`; editor workflows use their own model fields. |
| `N8N_PORT` | `5679` | Sets the local HTTP port for either launcher. |
| `N8N_RUNNERS_BROKER_PORT` | `N8N_PORT + 1`, normally `5680` | Sets the n8n task-runner broker port. Both ports must be available. |
| `N8N_USER_FOLDER` | `.local/n8n` | Chooses the state directory for `npm start`. The integration runner always creates its own isolated state and ignores this override. Use an absolute path. |
| `RESPAN_SPAN_NAME_STYLE` | `semantic` | Controls the linked instrumentation's exported span names. `legacy` preserves original n8n names for comparison. |
| `NODE_OPTIONS` | Existing process value | Preserved by the launcher, which appends the instrumentation preload. No manual preload configuration is needed. |

Both launchers bind n8n to `127.0.0.1`, load the compiled node from `dist`, and enable native workflow, node, and Agent tracing. They set the OTel endpoint, path, authorization header, and tracing flags themselves; exporting conflicting `N8N_OTEL_*` values does not override those settings. These are local development launchers.

Other n8n environment settings pass through when the launcher does not override them. For Agent workflows, `N8N_AGENTS_TRACING_RECORD_INPUTS=false` and `N8N_AGENTS_TRACING_RECORD_OUTPUTS=false` reduce recorded content. They do not suppress all Agent correlation fields; see [OBSERVABILITY_GUIDE.md](OBSERVABILITY_GUIDE.md) before using sensitive Agent data. The provided integration workflows do not use Agents.

## 5. Run the integration

```bash
npm run integration
```

The runner imports a credential and two workflows into a new local database, publishes the webhooks, starts n8n, executes both scenarios, and stops n8n to flush its exporter. The Gateway scenario performs **one provider-backed request** and checks the exact response marker and token usage. The invalid-metadata scenario checks that the node rejects an array where a JSON object is required.

Each invocation creates `.local/runs/<run-id>/` and prints the path to `evidence.json`. A successful local run still needs the separate trace-tree and Gateway-log review described in [OBSERVABILITY_GUIDE.md](OBSERVABILITY_GUIDE.md).

To select another model or free pair of ports:

```bash
RESPAN_MODEL=gpt-4o-mini N8N_PORT=5689 \
  N8N_RUNNERS_BROKER_PORT=5690 npm run integration
```

## 6. Open the editor or inspect a previous run

```bash
npm start
```

Open [http://127.0.0.1:5679](http://127.0.0.1:5679), or use your chosen `N8N_PORT`. Complete local owner setup if prompted. The default editor uses a separate `.local/n8n` state directory; create a **Respan API** credential in the editor for your own Gateway or prompt workflows. The launcher's trace-export key does not automatically create an editor credential.

To inspect a completed run, replace `<run-id>` with the directory name printed by the runner:

```bash
N8N_USER_FOLDER="$PWD/.local/runs/<run-id>/state" npm start
```

This opens that run's imported credential, workflows, and saved executions. Opening the editor does not rerun its webhooks. Stop any process already using that database before opening it; two n8n processes must not share the same state directory. Stop the editor with Ctrl-C before starting another process on the same ports. A new `npm run integration` always creates a new run and makes another provider request.

| Path | Contents |
| --- | --- |
| `.local/n8n/.n8n/` | Default editor database and encryption configuration. |
| `.local/runs/<run-id>/state/.n8n/` | Isolated integration database, encrypted credential, and encryption configuration. |
| `.local/runs/<run-id>/evidence.json` | Workflow IDs, trace IDs, Gateway log ID, execution checks, and run times. |
| `.local/runs/<run-id>/n8n.log` | Startup, import, execution, and shutdown output with the selected API key redacted. |
| `.local/runs/<run-id>/workflows.json` | Imported workflow definitions. |
| `.local/runs/<run-id>/*-response.json` | Saved scenario responses; the Gateway response is reduced to selected evidence fields. |

The runner deletes its temporary plaintext credential import file after import. Keep the state directory private: the encrypted credential and local encryption configuration are stored together, and the database can contain workflow inputs and outputs. `.local/` is ignored by Git. Inspect saved evidence before sharing it.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Node version error | Select Node 24 before installation and launch. |
| Missing workspace entry during a Respan build | Use the direct compiler fallback if dependencies already exist, or install the Respan workspace first. |
| Instrumentation import fails or `dist` is missing | Build all three Respan packages, run `npm ci` here, and build this node. Confirm the sibling layout and local links. |
| Unknown `CUSTOM.keywordsAi` node | Run `npm run build`, then use `npm start` or `npm run integration` so the custom extension directory is configured. |
| Port already in use | Stop the process using it or select a free HTTP/broker pair. |
| Gateway authorization or provider failure | Inspect the saved response and log, then check the Respan key and the account's access to the selected model. |
| No native trace after execution | Check `n8n.log`, confirm the trace API base, allow shutdown to flush, and search the exact trace ID and run time range in Respan. |
| A manually imported webhook is inactive | Publish the workflow and restart n8n when prompted. The integration runner does this automatically. |

`n8n execute` does not initialize the native OTel backend used by this setup. Use the provided runner's published webhook path when validating tracing.

For day-to-day commands, see [COMMANDS_CHEATSHEET.md](COMMANDS_CHEATSHEET.md).
