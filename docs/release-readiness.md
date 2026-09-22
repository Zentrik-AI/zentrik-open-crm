# Release readiness

This is the maintainer checklist for a public Open CRM release. It records the
checks a release must pass; it is not a promise that every hosted integration is
available in every edition.

## Product checks

Run these commands from a clean checkout with Node 22.18 or newer:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:package
npm run test:e2e
npm audit --json --ignore-scripts
git diff --check
```

The browser tests cover first use, account work, review, task ownership,
responsive layout, theme contrast, local feedback export, and storage recovery.
The package test installs the packed artifact without development dependencies and
checks the command, MCP server, UI, documentation, notices, and feedback intake.

## Public-safety checks

Before publishing a release, inspect the complete diff and the reachable history:

- fixtures, screenshots, launch media, and examples contain synthetic data only
- no credentials, session material, private URLs, customer records, or workspace
  identifiers are present
- public documentation does not describe private service internals
- new dependencies have compatible licenses and appear in
  `THIRD_PARTY_NOTICES.txt`
- `LICENSE`, `NOTICE`, `TRADEMARKS.md`, `SECURITY.md`, and contribution guidance
  are present and consistent
- source, package output, and launch assets do not include local paths or build
  artifacts

Use a secret scanner and a clean-install dependency audit. Review binary assets
for visible content and metadata. A scanner is evidence, not a substitute for a
human review of public wording and screenshots.

## Launch surfaces

Verify the following in a clean browser and from the packed package:

- a new user can choose demo or empty mode and understand where data is stored
- an account, source note, next action, export, and reset can be exercised
- an agent can read the documented workspace snapshot and propose reviewable work
- the Review screen makes approval and rejection clear
- Improve keeps drafts local by default and requires an explicit public review
- public feedback points to a working, moderated destination, or clearly says
  that the hosted destination is not available yet
- the launch film uses synthetic examples, labels illustrative agent behavior,
  and does not imply automatic sending or release

The local feedback bundle is portable. The optional maintainer adapter in
`scripts/import-reviewed-feedback.mjs` is server-side, requires explicit
configuration, and must not be enabled in browser code.

## Hosted integrations

Hosted services are separate release surfaces. Before linking one from the app,
verify its URL, authentication, moderation, privacy behavior, failure states,
and support path with the service owner. A configuration manifest is not proof
that a hosted instance exists.

The Open CRM browser and CLI remain useful without a hosted feedback service.
Manual GitHub handoff is available from Improve, and users can keep feedback
local until a public route is ready.

## Promotion

Use a reviewed pull request into the protected production branch. Re-run the
checks against the exact release commit, review the final package, and create a
release tag only after the public-safety, legal, and security-reporting checks
are complete. Hosted-integration checks apply only when a hosted destination is
included in the release; the local product and manual GitHub handoff do not
depend on one.

Do not rewrite published history to hide a mistake. If sensitive material ever
enters history, stop publication, rotate affected credentials, and create a
sanitized public history under the repository's incident procedure.
