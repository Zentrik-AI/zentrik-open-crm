# Releasing

Open CRM uses one protected branch. `main` is what users install; feature
branches start from `origin/main` and merge back through a pull request that
passes the required checks.

## Validate a change

From a clean checkout with Node 22.18 or newer:

```bash
npm ci
npm run typecheck
npm test              # core operations, the crm command, MCP, the local API
npm run build
npm run test:package  # pack, install without dev dependencies, check CLI/MCP/UI
npm run test:e2e      # browser edition and the agent-to-Review loop on a folder
```

The browser suite covers first use, account work, claims and the brief, review,
task ownership, responsive layout, theme contrast, feedback export, and storage
recovery. CI keeps synthetic screenshots and traces as the
`open-crm-browser-evidence` artifact.

## Before tagging a release

- [ ] The release commit is the exact commit that passed the checks above.
- [ ] Fixtures, screenshots, and examples use synthetic data only, on
      `.invalid`, `.example`, or `example.com` domains.
- [ ] No credentials, tokens, private URLs, workspace identifiers, customer
      records, or transcripts appear in the diff or in the reachable history.
- [ ] New dependencies carry compatible licenses and appear in
      `THIRD_PARTY_NOTICES.txt` (`npm run notices`).
- [ ] `npm audit --ignore-scripts` and a secret scan are clean. A scanner is
      evidence, not a substitute for reading the diff.
- [ ] A new user can choose demo or empty mode, work an account, run an agent
      proposal through Review, and export a backup.
- [ ] `LICENSE`, `NOTICE`, `TRADEMARKS.md`, `SECURITY.md`, `CHANGELOG.md`, and
      the contribution guidance are present and consistent.
- [ ] The README hero still shows the current product, and
      `assets/brand/open-crm-og.png` is set as the repository's social preview
      (Settings → General → Social preview; there is no API for it).

## Publishing

```bash
git tag -a v1.0.0 -m "Open CRM 1.0" && git push origin v1.0.0
npm publish            # zentrik-open-crm, public
```

`prepack` runs the full build, so publish from a clean checkout of the tagged
commit. `npm publish --dry-run` lists the tarball first.

`open-crm` is reserved as a thin alias package so `npx open-crm init ~/crm`
works: it carries one dependency on the same version of `zentrik-open-crm` and
a bin that execs the real one. Publish it after the canonical package, pinned
to the same version.

Do not rewrite published history to hide a mistake: stop the release, rotate
anything exposed, and fix forward.
