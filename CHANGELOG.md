# Changelog

## Unreleased

- Migrated visible branding, credentials, and Gateway/prompt API calls from Keywords AI to Respan while retaining the package, node, and credential identifiers used by saved workflows.
- Added managed-prompt schema version 2 requests, model-parameter patches, deployed/latest/numeric version handling, variable loading, and paginated prompt options.
- Added field-specific JSON validation and migration errors for unsupported streaming, legacy prompt overrides, and message/input patches.
- Added a Node.js 24 local runtime with n8n `2.37.7` and sibling-checkout Respan packages. The launcher preloads `@respan/instrumentation-n8n/register` to adapt n8n's native OpenTelemetry provider and exporter.
- Added an isolated webhook integration runner, private credential import, redacted process output, bounded shutdown, and per-run execution evidence.
- Added community-node regression coverage and rewrote setup, migration, commands, observability, and contribution guidance.

The migration's local and platform results, including incomplete checks, are recorded in [VALIDATION.md](VALIDATION.md). This section describes source changes; it does not establish a published package version.

## Historical source update — 2026-02-06

- Use `NodeApiError` and add `pairedItem` for n8n review compliance — chen sihan, [fc98f4d](https://github.com/respanai/n8n-keywordsai/commit/fc98f4dfcd5d0e31d4586a45e007161d8a71e168).

## 0.1.10 — 2025-12-31

- Release 0.1.10 — fran3cc, [b9b8d8f](https://github.com/respanai/n8n-keywordsai/commit/b9b8d8fdc038f521a6690ab42c1664393f93e389).
- Change name and author — fran3cc, [4b50d3a](https://github.com/respanai/n8n-keywordsai/commit/4b50d3a68db1ff06b6814d8d9c3f8c856c9ccae3).

## 0.1.8 — 2025-12-30

- Release 0.1.8 — fran3cc, [558c1b9](https://github.com/respanai/n8n-keywordsai/commit/558c1b90a25c64062b5860d916752c90eb59fb37).
- Swap icon colors for light/dark mode visibility — fran3cc, [44b0b88](https://github.com/respanai/n8n-keywordsai/commit/44b0b88b16b03aa8d712d172a497b5332171e24c).

## 0.1.7 — 2025-12-30

- Release 0.1.7 — fran3cc, [88603f1](https://github.com/respanai/n8n-keywordsai/commit/88603f1a91f6d7e867c8e4fd1f06997cd29a9aa2).
- Update repository URL format for n8n submission — fran3cc, [b1b7b31](https://github.com/respanai/n8n-keywordsai/commit/b1b7b3120a93909f74a3e880ce8e492ca2083ff5).

## 0.1.6 — 2025-12-30

- Release 0.1.6 — fran3cc, [43cb9e4](https://github.com/respanai/n8n-keywordsai/commit/43cb9e47cc8ff0d1812256f1597b7e6e0970b828).
- Initial commit — fran3cc, [10ab8b5](https://github.com/respanai/n8n-keywordsai/commit/10ab8b5e13059f0c2de957dc8b2adc0344cad131).
- n8n node — fran3cc, [752efeb](https://github.com/respanai/n8n-keywordsai/commit/752efeb2f29e4c408ed28a6dc1cff7d94d4c43b1).
- Finalized — fran3cc, [802f8ad](https://github.com/respanai/n8n-keywordsai/commit/802f8adbc64abdeb00d760f17debae0d38cd3fbf).

Historical dates and author names come from the commits retained in this repository. They are repository history, not a current registry availability statement.
