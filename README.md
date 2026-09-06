# Respan for n8n

Call Respan Gateway and use managed prompts from n8n. This repository includes a community node, a local n8n launcher, and a repeatable integration run with native tracing through `@respan/instrumentation-n8n`.

The node appears as **Respan** in the editor:

| Operation | Use it to |
| --- | --- |
| Gateway (Standard) | Send a model and conversation messages to Respan Gateway |
| Gateway with Prompt | Run a Respan prompt using its deployed, latest, or numbered version |

The local setup uses **Node.js 24**, **n8n 2.37.7**, and three packages built from a sibling Respan checkout. These instructions describe the migrated source in this checkout; they do not require a published instrumentation package.

The launcher and integration commands are source-checkout development workflows. The published community-node artifact provides the Respan node and credentials; it does not bundle n8n, the local instrumentation, or these launch scripts.

## Get started

Follow [INSTALL.md](https://github.com/respanai/n8n-keywordsai/blob/main/INSTALL.md) to clone the repositories, select Node 24, and build the local Respan packages. After those prerequisites, run these commands from `n8n-keywordsai`:

```bash
npm ci
npm run build
npm run integration
```

The runner reads `RESPAN_API_KEY` from your environment or the sibling `respan/.env`. It starts an isolated n8n instance and executes two webhook workflows:

1. Gateway requests an exact marker from `gpt-4o-mini` and checks its response and token usage.
2. Invalid metadata verifies an expected local validation error before a Gateway request.

The first workflow makes one billable model request. Both executions export native traces. The runner stops n8n when finished and prints its evidence path.

To select another dotenv file or an available model:

```bash
RESPAN_ENV_FILE=/absolute/path/to/respan.env npm run integration
RESPAN_MODEL=gpt-4o-mini npm run integration
```

Your Respan account must have access to the selected model. The dotenv file is parsed as data; there is no need to source it into a shell.

## Use the node in the editor

```bash
npm start
```

Open [http://127.0.0.1:5679](http://127.0.0.1:5679), complete local owner setup if prompted, and create a **Respan API** credential with your key. The launcher's key configures trace export; a new editor database still needs its own node credential.

Create **Manual Trigger → Respan**, select the credential, and choose an operation.

### Gateway (Standard)

For a small first request, set:

| Field | Example |
| --- | --- |
| Resource | Gateway (Standard) |
| Model | `gpt-4o-mini` |
| System Message | `Answer briefly.` |
| Messages → Role | User |
| Messages → Content | `What is distributed tracing?` |

Under **Additional Fields → Model Parameters (JSON)**, supply parameters accepted by the selected model:

```json
{"temperature":0,"max_tokens":100}
```

Execute the workflow. Each input item produces a JSON response containing the completion and provider usage. Later nodes can read the reply with `{{ $json.choices[0].message.content }}`.

### Gateway with Prompt

1. Choose **Gateway with Prompt** and select **Prompt Name or ID**.
2. Select **Version Name or ID** using the behavior below.
3. Add a value for each required prompt variable under **Variables**.
4. Optionally use **Model Parameters (JSON)** to patch the saved model configuration.
5. Execute the workflow and inspect the response.

| Version choice | Behavior |
| --- | --- |
| Deployed Version | Uses the prompt's deployed version; a deployed version must exist |
| Latest Version (Including Draft) | Uses the highest numbered version, which may be a draft |
| A numbered version | Uses that specific version |

Variable names must be nonempty and unique. Define message templates in Respan; `messages` and `input` are not accepted in a managed prompt's Model Parameters. Requests use prompt schema v2 with `variables` and a configuration `patch`.

The automated live runner exercises Gateway (Standard). Managed prompt request construction and loaders have regression tests; live prompt execution and editor dropdown interaction remain separate checks in [VALIDATION.md](https://github.com/respanai/n8n-keywordsai/blob/main/VALIDATION.md).

### Optional request fields

| Additional field | Purpose |
| --- | --- |
| Metadata (JSON) | Attach a JSON object to the Gateway request log |
| Custom Identifier | Set a request correlation value for log lookup |
| Customer Identifier | Associate the request with an end user |
| Customer Params (JSON) | Supply supported customer attributes as a JSON object |
| Request Breakdown | Include request metrics and diagnostics in the response |

For example, Metadata can be `{"workflow":"support-demo","scenario":"gateway"}`. Object fields reject arrays, primitive values, and malformed JSON. Streaming is unsupported; the node returns a complete JSON response for each item.

## Find executions and traces

The editor uses `.local/n8n`. Each automated run creates its own database under `.local/runs/<run-id>/state`. To inspect one in the editor, substitute its printed run ID:

```bash
N8N_USER_FOLDER="$PWD/.local/runs/<run-id>/state" npm start
```

Native tracing records the workflow and its nodes. The Gateway model request is a separate Respan log; the verified run does not have an LLM child inside the native tree. [OBSERVABILITY_GUIDE.md](https://github.com/respanai/n8n-keywordsai/blob/main/OBSERVABILITY_GUIDE.md) explains the expected tree, MCP queries, evidence files, and visibility limits.

## Upgrade an existing workflow

Read [MIGRATION.md](https://github.com/respanai/n8n-keywordsai/blob/main/MIGRATION.md) before importing older workflows. The package name `@keywordsai/n8n-nodes-keywordsai`, node name `keywordsAi`, and credential type `keywordsAIApi` are retained for compatibility. Their spelling is intentional.

The local launcher registers `CUSTOM.keywordsAi`. Community-package workflow exports may need their full node type changed for this local setup. Review saved legacy streaming and prompt override settings as well.

## Development and guides

```bash
npm test
npm run lint
```

`npm test` builds the node and runs local regression tests. The live integration is a separate command.

| Guide | Contents |
| --- | --- |
| [Installation](https://github.com/respanai/n8n-keywordsai/blob/main/INSTALL.md) | Repositories, builds, credentials, configuration, troubleshooting |
| [Migration](https://github.com/respanai/n8n-keywordsai/blob/main/MIGRATION.md) | Saved workflow compatibility and removed settings |
| [Observability](https://github.com/respanai/n8n-keywordsai/blob/main/OBSERVABILITY_GUIDE.md) | Native traces, Gateway logs, and MCP inspection |
| [Command reference](https://github.com/respanai/n8n-keywordsai/blob/main/COMMANDS_CHEATSHEET.md) | Daily development and local-run commands |
| [Contributing](https://github.com/respanai/n8n-keywordsai/blob/main/CONTRIBUTING.md) | Change scope, checks, and evidence requirements |
| [Project status](https://github.com/respanai/n8n-keywordsai/blob/main/PROJECT_STATUS.md) | Implemented behavior and remaining coverage |
| [Validation record](https://github.com/respanai/n8n-keywordsai/blob/main/VALIDATION.md) | Dated live-run results and exact identifiers |
| [Changelog](https://github.com/respanai/n8n-keywordsai/blob/main/CHANGELOG.md) | Unreleased changes and historical releases |

Repository: [respanai/n8n-keywordsai](https://github.com/respanai/n8n-keywordsai). See [LICENSE.md](https://github.com/respanai/n8n-keywordsai/blob/main/LICENSE.md) and [CODE_OF_CONDUCT.md](https://github.com/respanai/n8n-keywordsai/blob/main/CODE_OF_CONDUCT.md) for licensing and participation guidelines.
