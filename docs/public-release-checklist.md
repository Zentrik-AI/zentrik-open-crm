# Public Release Checklist

The repository should be private until every item in this checklist is complete.

## Repository State

- [ ] Remote is `Zentrik-AI/zentrik-open-crm`.
- [ ] Repository visibility is private during preparation.
- [ ] `main` has a clean, public-safe commit history.
- [ ] `develop` is the pre-production integration branch and contains no
      private data.
- [ ] No branches contain private Zentrik data or private customer material.
- [ ] No generated build output, local test artifacts, logs, or runtime state are
      tracked.
- [ ] `package.json` has license, repository, issue, and homepage metadata.
- [ ] `LICENSE`, `NOTICE`, and `TRADEMARKS.md` are present.

## History And Secret Review

- [ ] Full git history has been scanned for credentials, private URLs,
      workspace IDs, customer names, private transcripts, emails, screenshots,
      private exports, and production identifiers.
- [ ] Brand assets have been reviewed for private data in visible pixels and
      metadata.
- [ ] Commit messages do not mention private source repositories, private
      customer data, or internal-only rationale that would be awkward in public.
- [ ] If any sensitive material is found, the public repository is recreated
      from a sanitized export instead of publishing the existing history.

## GitHub Settings

- [ ] Branch protection is enabled for `main`.
- [ ] Required checks include the full `build` job on `develop` changes and
      `develop` -> `main` promotion pull requests; that job runs typecheck,
      build, and Playwright smoke tests.
- [ ] Production promotion uses a pull request from `develop` to `main`; direct
      feature pushes to `main` are not part of the workflow.
- [ ] A maintainer review was completed when practical (recommended, not a
      branch requirement during the early public-product phase).
- [ ] Secret scanning and push protection are enabled where available.
- [ ] Private vulnerability reporting is enabled before public visibility.
- [ ] Issues use the provided templates.
- [ ] Issue config points users toward Buildroom for product requests and
      private reporting for sensitive security issues.
- [ ] Discussions are enabled only if someone will moderate them.
- [ ] Forking is allowed (the organization setting blocks it on private
      repositories; confirm it is on once public).
- [ ] Repository description and topics match the product positioning.

## Product Readiness

- [ ] Clean checkout works with `npm ci` and `npm run dev`.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:e2e` passes.
- [ ] First-use path works with synthetic demo data, in the browser and on a
      workspace folder (`crm init --demo`, `./crm ui`).
- [ ] A coding agent opened cold in a demo workspace can run the daily review
      and its proposals arrive under Review.
- [ ] Public-safe mode is enabled by default or clearly available.
- [ ] Export/reset controls do not leak private runtime state.
- [ ] Buildroom submission flow explains public/private boundaries.
- [ ] Tell Open CRM can export an `open-crm-feedback.v1` bundle.
- [ ] GitHub-shaped feedback can be copied as a public issue draft.

## Legal And IP

- [ ] Apache 2.0 remains the default source license.
- [ ] Trademark policy has been reviewed.
- [ ] Third-party dependency license review is clean.
- [ ] Zentrik platform code, hosted services, private APIs, and proprietary
      product intelligence systems remain outside the public repository.
- [ ] Legal review is complete before changing visibility to public.

## Launch Surfaces

- [ ] README explains what the product is, who it is for, and how to run it.
- [ ] Contributing guide explains contribution license and data policy.
- [ ] Security guide gives a private vulnerability path.
- [ ] Feedback/support guide explains Tell Open CRM, Buildroom, GitHub Issues,
      support requests, and security reporting.
- [ ] Roadmap explains what is open-source, what is hosted later, and what is
      not part of the early release.
- [ ] Open CRM Buildroom portal resolves at the URL in the README and the issue
      template config. It must not show "Portal unavailable".

## Visibility Change

Only after the checklist is complete:

1. Confirm the latest commit on `main`.
2. Confirm no pending local changes.
3. Confirm all checks pass on GitHub.
4. Change repository visibility to public.
5. Create the first public release tag.
6. Announce with links to the repository, Buildroom, roadmap, and first-use
   guide.
