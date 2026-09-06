# Contributing

This checkout develops the Respan community node and its local n8n integration. Follow [INSTALL.md](INSTALL.md) to select Node.js 24, prepare the sibling `respan` checkout, build the local Respan packages, and install this repository's locked dependencies. The current dependency graph requires that sibling checkout.

## Make a change

| Location | Purpose |
| --- | --- |
| `nodes/KeywordsAi/` | Node fields, Gateway/prompt request handling, and option loaders |
| `credentials/KeywordsAIApi.credentials.ts` | Respan API credential configuration |
| `scripts/runtime.mjs` | Shared local n8n configuration, instrumentation preload, and process lifecycle |
| `scripts/start-n8n.mjs` | Local editor launcher |
| `scripts/run-integration.mjs` | Isolated Gateway and invalid-metadata workflows |
| `tests/keywords-ai-node.test.cjs` | Community-node regression coverage with mocked API requests |

Keep `@keywordsai/n8n-nodes-keywordsai`, `keywordsAi`, and `keywordsAIApi` stable unless the change includes an explicit saved-workflow migration. Visible product text should use Respan. Keep API mapping, editor help text, regression coverage, and [MIGRATION.md](MIGRATION.md) consistent when changing node behavior.

## Local checks

Run from this repository after setup:

```bash
npm test
npm run lint
git diff --check
```

`npm test` builds the node and runs the regression suite; it does not make live Respan requests. If you change package contents, also inspect `npm pack --dry-run`. These checks do not establish external-platform acceptance or publication.

For instrumentation changes, follow the sibling Respan repository's contribution rules and run that package's relevant tests there. This repository's community-node tests do not replace the instrumentation suite.

## Live integration evidence

When a runtime, API, or export change needs live validation, use:

```bash
npm run integration
```

The runner reads `RESPAN_API_KEY` from the environment or the configured dotenv file, defaults to `../respan/.env`, and makes one billable Gateway call in a successful run. It also executes an invalid-metadata case that must fail locally. Each run uses a new `.local/runs/<run-id>/` directory and records exact execution assertions in `evidence.json`.

Review the corresponding native trace trees and Gateway request log using the scoped procedure in [OBSERVABILITY_GUIDE.md](OBSERVABILITY_GUIDE.md). Check the actual content and parent relationships; preserve pending or NOT RUN status for checks that were not completed. The runner leaves platform checks pending for this separate review.

Record the run date, runtime/package versions, run marker, trace/log IDs, commands, outcomes, and observed limitations in a validation note. The existing [VALIDATION.md](VALIDATION.md) is a dated example, and [README_TEMPLATE.md](README_TEMPLATE.md) provides an authoring template for additional runnable examples.

Keep keys, imported credentials, n8n databases, and private execution payloads out of commits and review messages. `.local/` is ignored; share only the evidence needed to substantiate the change.

## CI and review

The [GitHub Actions workflow](.github/workflows/ci.yml) uses Node.js 24 and checks out the exact Respan n8n instrumentation revision validated by its upstream PR. It builds the linked Respan packages before installing this repository, then runs tests, lint, and a package dry run. CI does not run the billable integration or inspect the Respan platform.

In a change description, state the resulting behavior, compatibility impact, checks actually run, and any remaining live or platform limitations. Update the relevant guidance and [CHANGELOG.md](CHANGELOG.md). Package publication is a separate delivery step; a local build or pack dry run is not a release.
