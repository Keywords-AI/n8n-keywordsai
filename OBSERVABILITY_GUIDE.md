# Inspect n8n executions in Respan

Use the native trace to inspect workflow execution and the Gateway log to inspect the model request. The current integration records them separately.

## What gets recorded

| Output | Source | Useful information |
| --- | --- | --- |
| Native execution trace | n8n's provider/exporter adapted by the Respan instrumentation | Workflow and node names, parent links, timings, and status |
| Gateway request log | Respan Gateway | Model, provider, request/response content, usage, cost, and request metadata |
| Local evidence | The runner and isolated n8n database | Exact response marker, expected validation error, exit status, and platform lookup IDs |

The instrumentation translates n8n attributes into canonical fields, including nested `respan.metadata`. Some nested metadata and item counts were not visible in the recorded platform review. Distinguish what the translator emits from what the platform returns.

Native workflow/node spans do not contain node request/response bodies. This repository's Gateway workflow does not exercise n8n's separate Agent, LLM, tool, or memory tracing surfaces.

## Run with tracing

After [installation](INSTALL.md), run `npm run integration`. For editor workflows, use `npm start`.

Both launchers preload `@respan/instrumentation-n8n/register`, enable workflow and node tracing, and configure OTLP/HTTP Protobuf export to `https://api.respan.ai/api/v2/traces`. n8n owns the provider, batching, and shutdown. The Respan API key authenticates export, and manual-run tracing is enabled for local inspection. See [INSTALL.md](INSTALL.md) for endpoint configuration.

The runner supplies a W3C `traceparent` to each webhook, choosing its trace ID in advance. The workflow root has the supplied caller parent ID; no extra caller span is emitted.

## Read local evidence

The runner prints `.local/runs/<run-id>/evidence.json` on completion:

| File or directory | Contents |
| --- | --- |
| `evidence.json` | UTC run times, workflow IDs, trace IDs, Gateway log ID, execution checks, shutdown result |
| `workflows.json` | Imported workflows and their synthetic inputs |
| `gateway-response.json` | Selected completion fields, usage, and request-breakdown metrics |
| `invalid-metadata-response.json` | The webhook error response |
| `n8n.log` | Startup, execution, and shutdown output with the configured key redacted |
| `state/.n8n/` | Isolated database, encrypted credentials, and local encryption configuration |

`platform-review.json` is a separately saved artifact for the recorded run in [VALIDATION.md](VALIDATION.md). The script does not create it or call MCP automatically.

The runner checks that Gateway returns HTTP 200, the exact marker, positive usage, and a log ID. For invalid metadata, it checks the isolated database after shutdown for `NodeOperationError: Metadata must be a JSON object` on Respan Gateway. An import error, unexpected response, wrong failure, timeout, or failed shutdown makes the command fail.

Run directories are ignored by Git. Share selected evidence rather than the whole directory: n8n state includes credentials and execution data, and ordinary node responses may contain more request-breakdown fields than the runner saves.

## Inspect the same run with Respan MCP

Read `started_at`, `finished_at`, and the scenario IDs from `evidence.json`. Use the organization that received the export. Scope every lookup to those IDs and a UTC time range covering the run.

### Find each native trace

Call `list_traces` with this filter shape. Replace all angle-bracket placeholders:

```json
{
  "start_time": "<UTC time just before the run>",
  "end_time": "<UTC time just after the run>",
  "filters": [
    {"field": "trace_unique_id", "operator": "", "value": ["<scenario trace_id>"]}
  ],
  "page_size": 1
}
```

Call `get_trace_tree` with that `trace_id` and the same time range. The reference workflow has this structure:

```text
workflow  [entity name: <run-id>-<scenario>]
├── task  [entity name: Webhook]
└── task  [entity name: Respan Gateway]
```

Both tasks must point to the workflow span. The success scenario has three successful spans. In the invalid-metadata scenario, Webhook succeeds while Respan Gateway and the workflow fail.

Inspect entity names as well as the semantic names `workflow` and `task`. Record missing fields and misleading error classifications separately from execution status.

### Inspect the Gateway log

Use the successful scenario's `gateway_log_id` with `list_logs`:

```json
{
  "start_time": "<UTC time just before the run>",
  "end_time": "<UTC time just after the run>",
  "filters": [
    {"field": "unique_id", "operator": "", "value": ["<gateway_log_id>"]}
  ],
  "page_size": 1
}
```

Compare model, provider, status, token counts, response marker, and `metadata.run_id` with the local response. Call `get_log_detail` with the same log ID when full content is required. A truncated list response does not verify full input; record detail timeouts or missing fields explicitly.

The runner also sends `custom_identifier: <run-id>-gateway`, which supports an exact alternative lookup. To check for an unexpected invalid-scenario request, filter by the exact `<run-id>-invalid-metadata` identifier and the same run window.

The current Gateway log has no parent span ID connecting it to the native tree. n8n outbound trace-header configuration alone does not establish that link. Report the two records separately until matching trace and parent IDs are observed.

### Record the review outcome

The runner leaves `platform_check` as `PENDING_MCP_REVIEW`. Retain it until the platform is inspected. Record passed checks, unavailable fields, and operations that were not run. A successful webhook or exporter shutdown alone is not a complete platform review.

The dated [validation record](VALIDATION.md) contains exact IDs and observed metadata, error-classification, and log-detail limitations. Use new evidence when validating later changes.

## Correlate your own Gateway requests

Set these under **Additional Fields**:

| Editor field | API field | Example |
| --- | --- | --- |
| Metadata (JSON) | `metadata` | `{"run_id":"support-check-01","scenario":"gateway"}` |
| Custom Identifier | `custom_identifier` | `support-check-01-gateway` |
| Customer Identifier | `customer_identifier` | `demo-customer` |
| Customer Params (JSON) | `customer_params` | `{"customer_identifier":"demo-customer","name":"Demo"}` |
| Request Breakdown | `request_breakdown` | `true` |

Gateway request metadata does not automatically populate the native workflow metadata or connect both records into one trace.
