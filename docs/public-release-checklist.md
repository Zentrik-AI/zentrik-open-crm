# Public Release Checklist

The repository should be private until every item in this checklist is complete.

## Repository State

- [ ] Remote is `Zentrik-AI/zentrik-open-crm`.
- [ ] Repository visibility is private during preparation.
- [ ] `main` has a clean, public-safe commit history.
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
- [ ] Required checks include typecheck, build, and Playwright smoke tests.
- [ ] Secret scanning and push protection are enabled where available.
- [ ] Private vulnerability reporting is enabled before public visibility.
- [ ] Issues use the provided templates.
- [ ] Discussions are enabled only if someone will moderate them.
- [ ] Repository description and topics match the product positioning.

## Product Readiness

- [ ] Clean checkout works with `npm ci` and `npm run dev`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:e2e` passes.
- [ ] First-use path works with synthetic demo data.
- [ ] Public-safe mode is enabled by default or clearly available.
- [ ] Export/reset controls do not leak private runtime state.
- [ ] Buildroom submission flow explains public/private boundaries.

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
- [ ] Roadmap explains what is open-source, what is hosted later, and what is
      not part of the early release.
- [ ] Open CRM Buildroom portal exists or the placeholder points to the expected
      public surface.

## Visibility Change

Only after the checklist is complete:

1. Confirm the latest commit on `main`.
2. Confirm no pending local changes.
3. Confirm all checks pass on GitHub.
4. Change repository visibility to public.
5. Create the first public release tag.
6. Announce with links to the repository, Buildroom, roadmap, and first-use
   guide.
