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
npm run test:calls    # call import, evidence review and account investigation
```

## Hosted browser edition

Pushing app or build changes to `main` redeploys the hosted demo at
`https://demo.zentrik.ai/` from `.github/workflows/demo.yml`,
built with `OPEN_CRM_BASE` taken from the Pages configuration. This supports
both a project path and a custom domain at the root. It is the browser edition:
no server, no records anywhere but the visitor's own browser.

The `demo` CNAME points to `zentrik-ai.github.io.` and Pages enforces HTTPS.
After changing Pages domain settings, run `gh workflow run demo.yml --ref main`
to rebuild for the new path. Check the Demo workflow, DNS, certificate, and
first use in Chrome before publishing a new address:

```bash
dig +short CNAME demo.zentrik.ai
gh api repos/Zentrik-AI/zentrik-open-crm/pages
curl --fail --head https://demo.zentrik.ai/
```

For a future domain change, [add it to Pages before pointing DNS at it](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
to prevent another repository claiming the name. Do not change unrelated DNS
records or add a wildcard. Update the links in `README.md`,
`.github/ISSUE_TEMPLATE/config.yml`, `docs/first-use.md`, this file, and the
repository homepage only after the new address works over HTTPS.

Browser storage belongs to an origin. A custom domain cannot read records saved
on the old Pages origin. Export a JSON backup before changing origins and import
it on the new site; keep the old browser data until the import is verified.

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
      (Settings → General → Social preview; GitHub exposes no API for this, so
      it is a manual upload). Keep that file at exactly 1280x640 without an
      alpha channel: GitHub rejects a 2x export with "Something went really
      wrong and we can't process that picture".

## Publishing

The source install in the README and the hosted browser edition are available.
Neither `zentrik-open-crm` nor `open-crm` is published to npm yet; use the source
install until publication is complete.

Set the intended release version in the package, lockfile, brand and changelog,
then run the checks above from a clean checkout. Tag that checked version:

```bash
release_version=$(node -p "require('./package.json').version")
git tag -a "v${release_version}" -m "Open CRM ${release_version}"
git push origin "v${release_version}"
npm publish --access public  # add --tag next for a prerelease
```

`prepack` runs the full build, so publish from a clean checkout of the tagged
commit. `npm publish --dry-run` lists the tarball first.

`open-crm` is a planned thin alias package for `npx open-crm init ~/crm`: it
should carry one dependency on the same version of `zentrik-open-crm` and a bin
that execs the real one. Publish it after the canonical package, pinned to the
same version. Verify both registry entries before documenting npm installation
as available.

Do not rewrite published history to hide a mistake: stop the release, rotate
anything exposed, and fix forward.
