# Pre-production and release

Open CRM uses two long-lived branches:

- `develop` is the integration branch. Feature pull requests target it.
- `main` is the production branch. Promotion uses a pull request after the
  integration checks pass.

The browser edition stores data locally. The CLI and MCP server can share a
folder workspace with the app. A static deployment provides the browser edition
only.

## Validate a checkout

Create an ordinary feature branch or isolated worktree from the integration
branch, then run:

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

After the exact integration commit passes validation, open a pull request:

```bash
gh pr create --base main --head develop \
  --title "Release: <short theme>" \
  --body "Promote the validated integration state to production."
```

Keep the release ancestry visible with a merge commit. Public visibility,
release tagging, package publication, and hosted deployment are separate
actions. A hosted deployment is not required to release the local CLI or browser
application.
