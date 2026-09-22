# Release readiness

Audit date: 2026-09-21. This is a bounded release audit, not approval to publish.
The repository remains private. Local test, package, notice, and font gates below
are complete for the reviewed candidate. Media playback and production promotion
remain release-owner work; this is not clearance to change visibility.

## Verified evidence

- Remote `develop` at `24bb2afad00d36605eb5eb1a15edca4d56e841f0` passed
  [Checks run 35559981581](https://github.com/Zentrik-AI/zentrik-open-crm/actions/runs/35559981581).
  That run included dependency installation, typecheck, unit tests, installed
  package smoke, and browser tests. It does not validate later worktree changes.
- The audit observed `develop` four commits ahead of `main`, with no open
  promotion PR, tags, or releases. Recheck these changing values before release.
- GitHub secret scanning and push protection were enabled. The initial audit
  returned zero open secret-scanning and Dependabot alerts.
- A fresh dependency audit after the font additions reported zero known
  vulnerabilities across 138 lock entries. This is not a security certification.
- `LICENSE`, `NOTICE`, and `TRADEMARKS.md` are present. Package metadata declares
  Apache-2.0. Legal and trademark approval are not established by this audit.
- Final local logs were inspected: **128 unit passes, zero failures**
  (`open-crm-polish-unit-final2.log`); **21 browser passes, seven skips**
  (`open-crm-polish-e2e-final3.log`); installed-package smoke **passed**
  (`open-crm-polish-package-final4.log`). Skips are not passes. These runs include
  the integrated importer and final feedback changes; this audit verified their
  receipts rather than rerunning the suites.
- The validated tarball SHA-256 is
  `842f2112310c7da1f5fd70ea4e37635845ef3f4c47a874d8796b4451494d2acc`.
  Later documentation receipts can change package bytes; this digest identifies
  the tested artifact, not a guarantee about every subsequent pack.

## Dependency notices

`scripts/third-party-notices.mjs` derives the inventory from the production
entries in `package-lock.json`, including transitive runtime packages. It checks
installed names, versions, and license metadata against the lock. Missing
packages, missing or empty license files, unsupported license types, and
incomplete recognized license texts cause failure. Optional production packages
are not silently skipped; future platform-specific additions need explicit review.

The current inventory contains 11 packages: seven MIT, one ISC, and three
OFL-1.1 font packages. The font packages are `@fontsource-variable/inter`,
`@fontsource-variable/fraunces`, and `@fontsource/ibm-plex-mono`. Each installed
font package contains font files and a copyright-bearing OFL license. The
generator retains their full license texts, including reserved-name provisions.
Independent SHA-256 comparison confirmed that all three WOFF2 files imported by
`src/fonts.css` each match exactly one built file under `dist/assets/`. The
bundled font bytes match their installed, licensed originals for this build.

Output has stable package/file order, normalized line endings, and no timestamps
or machine paths. The top-level output is `THIRD_PARTY_NOTICES.txt`. After a
build, `--dist` also writes `dist/THIRD_PARTY_NOTICES.txt` for static distribution.
The existing Zentrik `NOTICE` remains separate.

Package integration is present: the build checks the root notices and generates
both outputs after compilation, the package allowlist includes the root file,
and installed-package smoke requires both outputs, direct dependency entries,
and OFL text. `node scripts/third-party-notices.mjs --check --dist` passed for
the final build. Installed-package validation passed for the tarball identified
above, including the compiled importer help check. `build:cli` compiles the
importer and its shared dependencies for installed execution. A package dry run
confirmed the compiled importer and zero missing relative README link targets
across 152 packaged files; remote link availability is not implied.

Generation, repeat comparison, coverage of all 11 packages and three fonts, and
synthetic missing/empty-license, metadata-mismatch, and missing-lock-entry
rejection were checked locally. The generator's
syntax check and scoped diff check passed. Build-tool license review remains separate;
the runtime inventory does not claim that all development dependencies are MIT.

## History review coverage

A separate access-restricted audit mirror fetched advertised repository refs
and explicit `refs/pull/*/head` and `refs/pull/*/merge` refs. The snapshot contained
72 local refs (two branches and 35 PR heads in two namespaces), 79 reachable
commits, and 378 unique historical blobs. No PR merge refs were advertised.
This extended
the initial local scan, which lacked five remote PR-head commits.

Gitleaks **8.30.1**, downloaded into temporary restricted storage, matched the
publisher's versioned checksum for `gitleaks_8.30.1_darwin_arm64.tar.gz`:
`b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5`.
No machine-wide installation was made. The release and checksum are available
at [Gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).

Two scans exited successfully with **zero findings** using default rules,
100% redaction, and inline allow-comments disabled:

- Git scan with `--log-opts="--all --full-history -m"`; Gitleaks reported 78
  scanned commits. This is its diff-scanned count, not the 79-commit reachability
  count above.
- Directory scan of all 378 exported historical blobs plus full author,
  committer, and message metadata. This supplements the diff scan; it does not
  make binary pixels searchable.

Limited independent text patterns also found zero credential, UUID, local-path,
private-repository-name, or non-example-email matches in text blobs. All 30
commit-message email occurrences were attribution trailers; zero were in
message prose. The three author/committer email identities represent the named
repository operator, GitHub commit attribution, and GitHub no-reply attribution.
These are intentional attribution metadata, not customer records or credentials.
No raw identity values are included here.

All 12 unique historical PNGs are byte-identical to their current files under
`assets/brand/`. A contact sheet and full-size views of the three UI screenshots
showed branded illustration or explicitly synthetic demo content; no private
customer content was identified. PNG structure inspection found zero text/EXIF
chunks and zero bytes after IEND. Eleven images had only structural/image-data
chunks. `assets/brand/open-crm-backdrop.png` also contains one 29,087-byte C2PA
provenance block. Its five CBOR payloads decoded successfully and contain
generation actions, timestamps, generator information, hashes, provenance
identifiers, and signature-related material. Selected email, local-path, and
credential patterns returned zero matches in that block. Its four UUID-shaped
values occur in provenance metadata; their presence is not evidence of a CRM
workspace identifier. This inspection did not validate the provenance signature.

This clears the scoped scanner, attribution, and 12-image review tasks for this
snapshot, not the entire public-release checklist. Unreachable objects,
unadvertised refs, GitHub issue/PR discussion content, and external artifacts
were not reviewed. Rerun scans on the final release state and review any newly
added images or media. No secret scanner proves absence of all private prose.

## Candidate delta review

The candidate scan includes tracked files and non-ignored proposed additions,
including `launch/`, the reviewed-feedback importer, its mocked tests, and its
loop documentation. Dependencies, build output, test artifacts, and temporary
files are excluded except the eight final launch keyframes and naming-study
still explicitly selected under `tmp/launch/`. Gitleaks uses the same verified
8.30.1 binary, default rules, 100% redaction, and disabled inline allow-comments.
The completed directory scan covered **170 repository files and nine launch
stills**, exited 0, and reported **zero findings**. File hashes were unchanged
during the scan. The final refresh included the feedback UI fixes and compiled
importer integration; the changed paths since the preceding snapshot were
`package.json`, `scripts/package-smoke.mjs`, and `src/views/ImproveView.tsx`.
The complete snapshot also includes the shared validator, importer tests, and
loop documentation. Later source or media edits require a delta check.

Launch source and all nine stills show illustrative synthetic account work.
The keyframe contact sheet matches the authored workflow and includes the
synthetic/illustrative and local-handoff qualifications. The nine PNGs contain
no unexpected ancillary metadata or bytes after IEND. This is public-safety
review of source and selected frames, not full audio/video playback acceptance.
The alternative product name remains an uncleared naming study.

The importer uses explicit environment configuration and synthetic test
identifiers. Dry-run is the default; execution requires a matching review hash
and destination preflights. No live API request was made by this audit. Source
review does not clear hosted intake, portal operation, or customer consent.
The separate live-intake verification is not certified by this report.

## Remaining release gates

The scoped live maintainer-intake attempt returned HTTP 402. A subsequent
read-only source-identity lookup found no matching Signal. No retry was made.
The local adapter is tested, but production intake acceptance and processing
remain unverified until the service access/plan gate is resolved. No live
destination identifiers or credentials are included in this repository.

- Review any edits after the recorded candidate scan and any new media,
  issue/PR discussion, or external artifacts included in the public launch.
- Confirm a working private security-reporting path. The API returned HTTP 404;
  this does not establish whether reporting is disabled or inaccessible. The
  security guide's fallback currently gives no concrete private contact.
- Reconcile GitHub controls with the documented promotion-through-PR rule.
  `main` requires strict `build`, applies checks to administrators, requires
  conversation resolution, and prevents force pushes/deletion. It has no
  required-PR configuration; repository rulesets numbered zero. No setting was
  changed by this work.
- Finish legal/trademark review and the remaining public-release checklist.
- Portal operation and issue/PR discussion content remain uncleared by this
  audit. Do not infer live service availability from source or an HTTP shell.
- Validate the final release commit and artifacts. Earlier passing CI cannot
  stand in for the changed dependency graph or later product work.

## Repeatable checks

Run from the repository with the intended dependency lock installed:

```bash
node scripts/third-party-notices.mjs
node scripts/third-party-notices.mjs --check
npm audit --json --ignore-scripts
git diff --check
gh api repos/Zentrik-AI/zentrik-open-crm/branches/main/protection
gh api repos/Zentrik-AI/zentrik-open-crm/rulesets
gh api repos/Zentrik-AI/zentrik-open-crm/private-vulnerability-reporting
gh api repos/Zentrik-AI/zentrik-open-crm/compare/main...develop
```

For later implementation changes, repeat `--check --dist`, package validation,
and the affected tests. Current local completion is recorded above; production
promotion still requires checks on its final commit. No publication or GitHub
setting change is part of these local notice-generation steps.
