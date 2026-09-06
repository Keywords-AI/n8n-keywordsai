# Migration validation — 2026-09-03

This record covers the local end-to-end validation used for the Respan migration. It does not assert package publication or complete coverage of every n8n feature.

## Validated configuration

- Base repository commit: `fc98f4d`
- Migration branch: `migrate/respan-native-instrumentation`
- Respan instrumentation commit used by the live run: `145503b1`
- Node.js: `24.19.0`
- n8n: `2.37.7`
- n8n-workflow: `2.37.2`
- Linked packages: `@respan/instrumentation-n8n@0.1.0`, `@respan/tracing@1.1.6`, and `@respan/respan-sdk@1.3.2`

The repository's CI uses the later green head of [respan PR #410](https://github.com/respanai/respan/pull/410), pinned at `5769847d99f808ab3fb15814af97f2b794ccc1d6`.

## Implemented behavior

- Updated the visible product name, credential help, Gateway host, and prompt APIs to Respan while retaining saved-workflow identifiers.
- Migrated managed-prompt requests to schema v2 with variables and configuration patches.
- Corrected prompt version labels, deployed/latest variable loading, and pagination.
- Added field-specific JSON validation and migration errors for unsupported streaming and legacy prompt override settings.
- Added a Node 24 launcher and isolated webhook runner with private credential import, redacted logs, bounded shutdown, and concise evidence.
- Preloaded `@respan/instrumentation-n8n/register` so n8n owns the native provider, batching, exporter, and shutdown.

## Results

| Check | Result |
| --- | --- |
| Local Respan SDK, tracing, and instrumentation compilation | PASS |
| n8n instrumentation suite | 17/17 PASS |
| Community-node build and regression suite | 16/16 PASS |
| Community-node lint | PASS |
| Local package resolution and package dry run | PASS |
| Real Gateway webhook workflow | PASS; exact marker returned |
| Invalid metadata workflow | PASS; exact expected local rejection |
| Respan MCP native tree review | PASS for both scenario trees |
| Respan MCP Gateway log review | PASS for marker, output, model, provider, usage, cost, and status |
| Live managed-prompt inference and editor dropdown interaction | NOT RUN; request construction and loaders have regression coverage |
| n8n Agent, tool, and memory workflows | NOT RUN in this repository's live integration |

The final live run was `respan-n8n-2026-09-03T11-47-05-011Z`, from `11:47:05Z` through `11:47:17Z`.

| Scenario | Trace or log ID | Observed result |
| --- | --- | --- |
| Gateway workflow | `920701bde9afafe132bc250b67a82943` | Three spans and no errors |
| Invalid metadata workflow | `b79785e885118b845bf704cfa2f9882f` | Three spans; workflow and Gateway task failed while Webhook succeeded |
| Gateway request log | `86abbd809e594b0b81ce354f04dd3164` | OpenAI `gpt-4o-mini`, HTTP 200, 41 input tokens, 21 output tokens, and `$0.00001875` cost |

Both native trees contain a `workflow` root with `Webhook` and `Respan Gateway` task children. Each child points to the workflow span. The root's external parent comes from the runner's W3C `traceparent`; the runner does not emit an artificial caller span.

The Gateway output exactly matched the run marker. Read-only inspection of the isolated n8n database confirmed the negative case failed at `Respan Gateway` with `NodeOperationError: Metadata must be a JSON object`. n8n stopped cleanly after exporter shutdown.

Local evidence and n8n state remain under the ignored `.local/runs/<run-id>/` directory. They are intentionally excluded because the database contains an encrypted credential together with its local encryption configuration and can contain execution payloads.

## Observed limitations

- The Gateway request is a separate platform log without a parent span ID. It is not an LLM child in the native execution tree.
- Native workflow/node tracing does not capture node request/response bodies, and this run does not exercise Agent, tool, or memory tracing.
- Nested n8n metadata and item counts were not visible in the platform trace responses.
- The platform classified the deliberate local metadata error as `provider_down`; the isolated execution record confirms the real cause was configuration validation.
- Individual log-detail requests timed out. The exact-ID MCP listing confirmed output and usage but truncated input, so complete platform input retrieval remains unverified.
- n8n printed a generic OpenTelemetry diagnostic warning and an unused Python-runner warning. Both native trees were independently present after clean shutdown.

## Repeat the checks

Follow [INSTALL.md](INSTALL.md), select Node 24, and run:

```bash
npm test
npm run lint
npm run integration
```

The integration command creates a fresh isolated run and performs one billable Gateway request. It validates local execution but leaves platform status pending. Use the exact procedure in [OBSERVABILITY_GUIDE.md](OBSERVABILITY_GUIDE.md) to inspect the resulting traces and Gateway log.
