# Example documentation template

Use this template when adding a runnable workflow example. The repository's onboarding guide is [README.md](README.md); this file is an authoring aid. Copy the sections below into the example's documentation, fill in the bracketed placeholders and command, and replace each author note with the requested content.

Document an implemented command and its actual assertions. The existing runner is `npm run integration`; a new command must exist in `package.json` before it is described as runnable. Refer to [INSTALL.md](INSTALL.md) for shared setup and [MIGRATION.md](MIGRATION.md) for saved-workflow changes.

---

# [Example name]

> **Replace:** Describe the user-visible behavior and the workflow nodes that exercise it. State whether it calls Respan Gateway, a managed prompt, or another provider.

## Requirements

| Requirement | Value for this example |
| --- | --- |
| Runtime | [Exact Node.js and n8n versions exercised] |
| Package source | [Local checkout/commit or a verified released version] |
| Credentials | [Environment variable or n8n credential name; never a key value] |
| Account resources | [Required provider access, prompt ID/version, or none] |
| External calls | [Which services receive requests and whether the run is billable] |

## Run

> **Replace:** Link to the workflow and runner files. Give the exact working directory, configuration, and command. If it uses the shared launcher, explain that the environment's `RESPAN_API_KEY` overrides the key read from the file selected by `RESPAN_ENV_FILE` (default: `../respan/.env`). List only overrides this example actually supports.

```bash
# Template placeholder: replace with the implemented command.
<run-command>
```

> **Replace:** State where the command saves state and evidence, how it shuts n8n down, and whether it imports or publishes workflows. Describe the expected output and any deliberate error case.

## Verify the result

| Evidence | Required observation |
| --- | --- |
| Workflow execution | [Expected output and precise success/error assertion] |
| Native trace tree | [Expected root, children, parent relationships, and statuses] |
| Span content | [Fields this workflow should emit and fields it intentionally omits] |
| Gateway request log, if used | [Run marker/log ID, output, model/provider, usage, and status] |
| Gateway/native-trace correlation, if claimed | [Observed trace ID and parent span ID linking the request to the native tree] |

> **Replace:** Name the evidence files and identify the run marker, time range, and trace/log IDs needed for a scoped platform review. A runner's execution result alone does not complete the platform checks. Use [OBSERVABILITY_GUIDE.md](OBSERVABILITY_GUIDE.md) as the review procedure.

## Recorded result and limitations

> **Replace:** Record the date, dependency versions/commits, commands run, and result of each applicable check. Keep unexecuted cases as NOT RUN and incomplete platform checks as pending. Distinguish local execution failures from platform display or retrieval problems.

> **Replace:** List only observed limitations. Link to the validation record, and state which feature paths the example does not exercise. Never include credentials, raw private execution data, or an unverified registry/release claim.
