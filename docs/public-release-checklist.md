# Public release checklist

Use this checklist before changing repository visibility or publishing a
release. Keep it with the repository so each release can be checked against the
same public contract.

## Repository

- [ ] The final commit comes from the reviewed production branch.
- [ ] No generated build output, logs, runtime state, or local test artifacts
      are tracked.
- [ ] Fixtures, screenshots, videos, and examples use synthetic data only.
- [ ] No credentials, session tokens, private URLs, workspace identifiers,
      customer records, or private transcripts are present.
- [ ] `package.json`, `LICENSE`, `NOTICE`, `TRADEMARKS.md`, `SECURITY.md`, and
      contribution guidance are present.
- [ ] Commit subjects and public descriptions describe the shipped change in
      neutral, user-facing language.

## History and dependencies

- [ ] Reachable history has been scanned for secrets and private material.
- [ ] Public issue and pull-request text has been reviewed for private links or
      sensitive context.
- [ ] Binary assets have been checked for private pixels and metadata.
- [ ] A clean dependency install and license audit pass.
- [ ] `THIRD_PARTY_NOTICES.txt` matches the production dependency graph.

## Product

- [ ] A clean install passes `npm run typecheck`, `npm test`, `npm run build`,
      `npm run test:package`, and `npm run test:e2e`.
- [ ] First use works with synthetic demo data and with an empty workspace.
- [ ] Account, contact, source note, next action, export, and reset flows work.
- [ ] An agent can read the documented snapshot and propose reviewable work.
- [ ] Review makes approval, rejection, and source context clear.
- [ ] Improve keeps drafts local by default and requires explicit public review.
- [ ] The launch film uses synthetic examples and makes no automatic-send or
      autonomous-release claim.

## Hosted surfaces

- [ ] Every linked hosted URL resolves to the intended product.
- [ ] Authentication, moderation, privacy, accessibility, failure states, and
      support are verified for each hosted surface.
- [ ] The local app remains useful when hosted services are unavailable.
- [ ] The feedback guide states which routes are live and which are planned.

## Legal and operations

- [ ] Apache 2.0 and third-party notices are correct.
- [ ] Trademark and public-brand review is complete.
- [ ] A private vulnerability-reporting path is available and documented.
- [ ] Branch checks and promotion rules are configured for the release branch.
- [ ] The final release tag and package were built from the exact reviewed commit.

Only after these checks pass should maintainers change visibility, create the
first public tag, or announce the repository.
