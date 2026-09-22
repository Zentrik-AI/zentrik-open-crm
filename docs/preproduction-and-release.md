# Pre-production and release

Open CRM uses one protected production branch:

- `main` is the integration and production branch. Feature pull requests target
  it and must pass the required checks before merge.

The browser edition stores data locally. The CLI and MCP server can share a
folder workspace with the app. A static deployment provides the browser edition
only.

## Validate a checkout

Create an ordinary feature branch or isolated worktree from `origin/main`, then
run:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:package
npm run test:e2e
```

Keep uncommitted work in its own checkout. Do not reset or delete a checkout to
make it clean. Use [Release readiness](./release-readiness.md) for the full
public-safety and launch checklist.

## Promote a release

After the exact feature commit passes validation, open a pull request:

```bash
gh pr create --base main --head <feature-branch> \
  --title "<short theme>" \
  --body "Describe the user-facing change and its validation."
```

Keep the review and validation record visible. Public visibility, release
tagging, package publication, and hosted deployment are separate actions. A
hosted deployment is not required to release the local CLI or browser
application.
