# Respan migration status

This repository provides a migrated Respan Gateway and managed-prompt community node, plus a local n8n runtime that loads `@respan/instrumentation-n8n/register`. The community node makes API requests; the instrumentation package adapts n8n's native OpenTelemetry provider and exporter.

Start with [README.md](README.md) and [INSTALL.md](INSTALL.md). For saved Keywords AI workflows, follow [MIGRATION.md](MIGRATION.md).

## Implemented scope

| Area | Behavior in this checkout |
| --- | --- |
| Runtime | Node.js 24, n8n `2.37.7`, n8n-workflow `2.37.2` |
| Local packages | Respan SDK, tracing, and n8n instrumentation linked from the sibling `respan` checkout |
| Gateway | Respan Chat Completions requests with JSON responses and supported request metadata |
| Managed prompts | Schema version 2, variables, deployed/latest/numeric versions, model-parameter patches, and paginated prompt loading |
| Input validation | Field-specific errors for malformed or non-object JSON, invalid prompt versions, duplicate variable names, and unsupported legacy settings |
| Compatibility | Existing package name, node ID `keywordsAi`, and credential ID `keywordsAIApi` retained |
| Local launcher | Instrumentation preload, loopback-only editor, and configuration read from environment or `../respan/.env` |
| Integration runner | Isolated n8n state, credential/workflow imports, webhook execution, bounded shutdown, and saved evidence per run |

The local launcher loads the compiled node as `CUSTOM.keywordsAi`. Saved streaming settings and the old prompt override flag must be removed or set to `false`; see the migration guide for replacement settings.

## Recorded verification — 2026-09-03

These are the results recorded in [VALIDATION.md](VALIDATION.md), for this local migration. The live run was `respan-n8n-2026-09-03T11-47-05-011Z`, using local Respan commit `145503b1` on `feat/instrumentation-n8n-javascript` and Node.js `24.19.0`.

| Check | Recorded result |
| --- | --- |
| Local Respan SDK, tracing, and instrumentation compilation | PASS |
| n8n instrumentation regression suite | 17/17 PASS |
| Community-node build and regression suite | 16/16 PASS |
| Community-node lint | PASS |
| Local package resolution and npm pack dry run | PASS |
| Real Gateway webhook workflow | PASS; exact run marker and provider usage returned |
| Invalid-metadata workflow | PASS; the isolated execution database confirms the expected `NodeOperationError` at `Respan Gateway` |
| Scoped Respan MCP native tree review | PASS; one workflow root and two task children for each scenario, with the expected success/failure statuses |
| Scoped Respan MCP Gateway request-log review | PASS for the marker, output, model, provider, usage, cost, and status |
| Live managed-prompt inference and editor dropdown interaction | NOT RUN; request mapping and loaders have regression coverage |
| n8n Agent, tool, and memory workflows | NOT RUN in this repository's live integration |

`npm run integration` records execution checks. It does not run Respan MCP inspection: new runs leave platform checks pending until the corresponding trees and request logs are reviewed. Full acceptance depends on the content checks in [OBSERVABILITY_GUIDE.md](OBSERVABILITY_GUIDE.md).

## Outstanding validation and platform limitations

- The Gateway request appeared as a separate platform log without a parent span ID. A joined LLM child under the native workflow trace was not demonstrated.
- Native workflow/node spans had no request or response bodies. Nested n8n metadata and item counts were not visible in platform trace responses.
- The platform labeled the deliberate local metadata-validation error `provider_down`. The execution database confirmed the actual configuration error.
- Individual log-detail requests timed out. The scoped log listing confirmed output and usage but truncated input; complete platform input retrieval remains unverified.
- n8n emitted a generic OpenTelemetry diagnostic warning and an unused Python-runner warning during the recorded run. Both native trees were confirmed after clean shutdown.
- Managed-prompt execution and editor interactions need a separate live case using a configured prompt. Agent, tool, and memory coverage needs corresponding workflows.

## Automation and delivery

The checked-in [CI workflow](.github/workflows/ci.yml) selects Node.js 24, checks out the exact green Respan n8n instrumentation revision from [respan PR #410](https://github.com/respanai/respan/pull/410), builds the three linked packages, and runs this repository's tests, lint, and package dry run. [CONTRIBUTING.md](CONTRIBUTING.md) lists the matching local checks.

This status does not assert npm availability, PR status, or release readiness. Local build, live execution, platform validation, and publication are separate outcomes. Use the dated validation record for the evidence and limitations of the completed run.
