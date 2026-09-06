# Migrate a Keywords AI workflow to Respan

Use this guide for workflows created with the older Keywords AI community node. Export a copy before editing its JSON, then test that copy with a small synthetic input.

## Names and credentials

The editor now displays **Respan** and **Respan API**. These identifiers remain unchanged so existing references still resolve:

| Identifier | Retained value |
| --- | --- |
| npm package | `@keywordsai/n8n-nodes-keywordsai` |
| Node name | `keywordsAi` |
| Credential type | `keywordsAIApi` |
| Model Parameters storage field | `additionalFields.overrideParamsJson` |

Do not rename these values to `respan` in saved JSON. Update an existing credential with a Respan API key, or create a **Respan API** credential and select it on the node. Credential IDs belong to an n8n database; importing a workflow into a new database does not import its credentials.

### Community-package and local node types

A community-package installation uses a type such as `@keywordsai/n8n-nodes-keywordsai.keywordsAi`. This repository's custom-directory loader registers `CUSTOM.keywordsAi`.

When importing into this local launcher, change the matching node's `type` in the exported copy, or add a Respan node in the destination editor and copy its parameters. Preserve node names and connections. Keep the `keywordsAIApi` credential type and select a credential that exists in the destination database.

## API destination

The maintained node calls `https://api.respan.ai/api` for Gateway requests and prompt loading. Existing HTTP Request nodes or custom scripts calling retired Keywords AI hosts need their own URL and credential updates.

`RESPAN_BASE_URL` changes the launcher's native trace-export base only. It does not redirect the community node's Gateway or prompt requests. See [INSTALL.md](INSTALL.md) for configuration precedence.

## Review saved parameters

| Older setting | Current behavior | Migration action |
| --- | --- | --- |
| `additionalFields.stream: true` | Rejected; this node returns JSON | Remove it or set it to `false` |
| `stream: true` inside Model Parameters | Rejected | Remove it or set it to `false` |
| `override: true` for a managed prompt | Rejected | Remove the flag or set it to `false`; use Model Parameters for a patch |
| Override Params (JSON) | Displayed as Model Parameters (JSON); stored name unchanged | Review its object for streaming or message settings |
| `messages` or `input` in managed-prompt Model Parameters | Rejected | Edit the prompt template in Respan and supply Variables |
| Empty prompt version | Uses the deployed version | Ensure a deployed version exists |
| `latest` prompt version | Uses the highest numbered version, including drafts | Select a number or Deployed Version if drafts should not run |
| Non-object Metadata or Customer Params | Rejected | Supply a JSON object |

Removed controls can remain in exported JSON even though the new editor does not display them. Edit those saved fields in the copied workflow before reimporting it.

This example shows current managed-prompt parameters. Replace the prompt ID and variable name with values from your prompt:

```json
{
  "resource": "gatewayPrompt",
  "promptId": "replace-with-your-prompt-id",
  "version": "",
  "variables": {
    "variableValues": [
      {"name": "question", "value": "What is distributed tracing?"}
    ]
  },
  "additionalFields": {
    "overrideParamsJson": "{\"temperature\":0,\"max_tokens\":100}",
    "metadata": "{\"scenario\":\"migration-check\"}"
  }
}
```

The node converts this to prompt schema v2, puts Model Parameters in `prompt.patch`, and forces streaming off. Custom Identifier, Customer Identifier, Customer Params, Metadata, and Request Breakdown remain supported; do not remove them solely because they existed in the older node.

## Replace tracing setup

After building the local packages, use `npm start` or `npm run integration`. Both preload `@respan/instrumentation-n8n/register` before n8n starts and configure n8n's native exporter.

The community node sends Gateway requests; it is not a tracing exporter. Remove old tracing bootstrap from the process configuration if it would create another provider, reconstruct execution spans, or export the same traces twice. The Gateway request and native workflow trace remain separate outputs in this setup.

The automated runner starts n8n and invokes webhooks. The `n8n execute` CLI path does not initialize the native OTel service used here.

## Verify the migrated copy

1. Follow [INSTALL.md](INSTALL.md) to build and start the local integration.
2. Import the copied workflow and select its Respan credential.
3. Execute a small request and inspect its response or field-specific error.
4. For managed prompts, verify the selected version and variables with a prompt you control. The automated Gateway runner does not test this operation live.
5. Inspect the native trace and Gateway log using [OBSERVABILITY_GUIDE.md](OBSERVABILITY_GUIDE.md).

`npm run integration` provides separate reference workflows for a successful Gateway call and a deliberate validation failure. Those results do not validate every imported workflow.
