# Local command reference

Run these commands from the migrated `n8n-keywordsai` checkout with Node 24 selected. Follow [INSTALL.md](INSTALL.md) once to prepare and build the sibling Respan packages before installing this repository.

## Install, build, and check

| Command | Purpose |
| --- | --- |
| `nvm use` | Select Node 24 from `.nvmrc`; use `nvm install 24` first if needed. |
| `npm ci` | Install the locked dependency graph, including n8n `2.37.7` and the three local Respan links. |
| `npm run build` | Compile the community node and credentials into `dist`. |
| `npm test` | Build the node and run local regression tests; no live provider call. |
| `npm run lint` | Check node conventions. |
| `npm run lint:fix` | Apply available lint fixes; inspect the resulting diff. |
| `npm run build:watch` | Recompile TypeScript while editing; restart n8n to load changes. |
| `npm ls --depth=0 n8n @respan/instrumentation-n8n @respan/tracing @respan/respan-sdk` | Inspect the installed runtime and local package links. |

Use the repository's `.npmrc` and lockfile together. `npm ci` replaces this repository's `node_modules`; it leaves the sibling source checkouts intact. To rebuild linked packages after a source change, use the Yarn commands or the existing-workspace compiler fallback in [INSTALL.md](INSTALL.md#2-build-the-respan-packages).

## Run the editor

```bash
npm start
```

Open [http://127.0.0.1:5679](http://127.0.0.1:5679). This uses `.local/n8n` for state, loads the built community node, and enables native tracing. Create a Respan API credential in the editor for your own workflows.

Read the trace-export key from a different dotenv file:

```bash
RESPAN_ENV_FILE=/absolute/path/to/respan.env npm start
```

Use another local HTTP/broker pair:

```bash
N8N_PORT=5689 N8N_RUNNERS_BROKER_PORT=5690 npm start
```

The default key file is `../respan/.env`. Only its `RESPAN_API_KEY` and `RESPAN_BASE_URL` settings are read, with process environment values taking precedence. See the complete [configuration table](INSTALL.md#4-configure-the-respan-key) for model, endpoint, state, and tracing options.

## Run the live integration

```bash
npm run integration
```

Each invocation creates a new `.local/runs/<run-id>/`, performs one provider-backed Gateway request and one local validation-error scenario, then stops n8n. To choose a model and ports:

```bash
RESPAN_MODEL=gpt-4o-mini N8N_PORT=5689 \
  N8N_RUNNERS_BROKER_PORT=5690 npm run integration
```

The runner prints the `evidence.json` path. Review its execution checks, then use its exact trace IDs, Gateway log ID, and time range for the separate Respan checks in [OBSERVABILITY_GUIDE.md](OBSERVABILITY_GUIDE.md). `PENDING_MCP_REVIEW` is not a platform pass.

## Inspect a completed run

Replace `<run-id>` with an existing run directory name:

```bash
N8N_USER_FOLDER="$PWD/.local/runs/<run-id>/state" npm start
```

The editor opens the saved workflows, credential, and executions without automatically invoking the webhooks again. Use only one n8n process per state directory. Stop it with Ctrl-C before using the same ports for another process. `N8N_USER_FOLDER` applies to `npm start`; the integration runner always creates separate state.

Keep `.local/` private because it contains execution data and n8n's credential encryption configuration. Saved responses and trace evidence can also contain workflow content.

## Choose the maintained launch command

Use `npm start` for this repository's instrumented editor and `npm run integration` for its repeatable tracing check. The inherited `npm run dev` invokes the generic n8n node CLI and does not apply this repository's launcher configuration. `n8n execute` does not start the native OTel backend used by the tracing check.

`release` and `prepublishOnly` are package publication scripts, not setup steps. The local instrumentation build does not require publishing either repository.
