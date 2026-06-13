# Contributing

Zentrik Open CRM welcomes product, design, code, documentation, and integration
contributions.

## Before Contributing

1. Run the app locally and use the workflow you want to improve.
2. Keep account data in examples synthetic and clearly fictitious.
3. Preserve source-grounded behavior. If the app recommends action, it should be
   clear what signal caused that recommendation.
4. Keep new UI consistent with the existing semantic tokens and compact CRM
   workflow style.

## Useful Contribution Types

- product workflow improvements that make daily account work clearer
- better first-use, self-hosting, and local setup documentation
- source-grounding fixes where a recommendation lacks evidence
- privacy improvements, especially around public Buildroom mode
- integrations that have explicit data boundaries and clear setup docs
- tests that protect core CRM flows on desktop and mobile

## Issue Flow

Use the issue template that matches the work:

- bug reports for broken behavior or regressions
- feature requests for product increments
- source-grounding issues when evidence, provenance, or privacy behavior is weak
- good-first-product issues for narrow changes that help new contributors

Describe the user workflow first. Technical suggestions are welcome, but the
maintainer needs to understand the account-work or product-loop problem.

## Pull Request Standard

Every pull request should state:

- what changed
- which user workflow it improves
- whether it touches data handling, privacy, or public Buildroom behavior
- how it was validated

## Labels

Labels are routing and triage metadata, not decoration — every label should route a review, drive release notes, or drive triage. Apply them in GitHub (`gh pr edit --add-label …`), not in the PR body.

| Label | Apply when | What it does |
| --- | --- | --- |
| `bug` | Fixes incorrect behavior or a regression | Release-notes "Fixes"; triage priority |
| `enhancement` | New capability or materially expanded behavior | Release-notes "Features" |
| `experience` | UX/interaction polish with no new feature headline | Release-notes "Experience / polish" |
| `performance` | Latency, payload, or query-cost work | Requires before/after benchmark evidence in the PR |
| `security` | Auth, secrets, customer data, privacy/Buildroom, or infra | Flags a security review; add a one-line security/privacy note in the body |
| `integrations` | Provider connections, imports/exports, OAuth flows | Integration review: data boundaries and setup docs |
| `dependencies` | Manifest, lockfile, or version updates | Dependency-update track (Dependabot) |
| `documentation` | Setup, self-hosting, or explanatory content | Lighter validation bar |
| `release-notes` | Changelog or release-communication content | Pulled into the release rollup |

As a public repository, `good first issue`, `help wanted`, and `question` stay for community triage. There is no `migration` label here — this repo carries no production schema.

## Contribution License

Unless you clearly state otherwise before a contribution is included, anything
you intentionally submit to this repository is contributed under the Apache
License 2.0.

Only submit work you have the right to contribute. Do not submit code,
screenshots, fixtures, logs, docs, or examples copied from private employer
systems, private Zentrik workspaces, customer environments, transcripts, emails,
or confidential product plans.

For larger corporate contributions, Zentrik AI may ask for additional
contributor confirmation before merging.

## Local Checks

```bash
npm run typecheck
npm run build
npm run test:e2e
```

## Data Policy

Do not include real customer records, private operating data, API keys, private
transcripts, emails, screenshots, or exports in issues, pull requests, fixtures,
or docs.

Use `.invalid`, `.example`, or `example.com` domains for sample accounts. If a
test needs realistic source material, summarize public information and cite the
source in documentation when needed.

## Zentrik IP Boundary

This repository is the open-source CRM product. Do not copy private Zentrik app
code, hosted-service internals, private workspace schemas, production IDs,
runtime credentials, proprietary insight-generation logic, or private
orchestration systems into this repository.
