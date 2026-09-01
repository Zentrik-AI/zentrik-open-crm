# Pre-production And Release

Open CRM uses two long-lived branches:

- `develop`: the integration and pre-production branch. Normal feature pull
  requests target this branch.
- `main`: the production source. Promotion from `develop` uses a pull request
  and the protected `build` check. Human review is encouraged but not required
  for now; the branch remains protected by its other controls.

The repository is a browser-only Vite application. It does not yet have a
hosted Fly or Pages environment, so the running pre-production surface is a
persistent local sandbox checkout. GitHub also stores the validated `dist/`
bundle from each push to `develop` for fourteen days as an audit artifact.

## Create The Sandbox

From the Zentrik workspace root:

```bash
git -C zentrik-open-crm fetch origin develop --prune
zentrik-agent-workflows/bin/zentrik-worktree --repo zentrik-open-crm create \
  --slug open-crm-develop-sandbox --base origin/develop
cd worktrees/zentrik-open-crm-open-crm-develop-sandbox
npm ci
zentrik-agent-workflows/bin/zentrik-worktree --repo . prepare
zentrik-agent-workflows/bin/zentrik-worktree --repo . up --profile sandbox
```

The shared command creates an isolated local branch from `origin/develop`,
assigns a stable frontend port, and records runtime ownership. The sandbox
branch is a review checkout, not a feature branch for committing work.

Inspect or stop it with:

```bash
zentrik-agent-workflows/bin/zentrik-worktree --repo . info
zentrik-agent-workflows/bin/zentrik-worktree --repo . down
```

## Refresh The Sandbox

Stop the runtime first. Then preserve the checkout if it has local changes and
fast-forward only when it is clean:

```bash
git fetch origin develop --prune
git status --short
git merge --ff-only origin/develop
npm ci
```

Do not reset the sandbox or remove uncommitted files. Move any real feature
work into a normal feature worktree based on `origin/develop`.

## Promote To Production

After the sandbox and CI checks pass:

```bash
gh pr create --repo Zentrik-AI/zentrik-open-crm \
  --base main --head develop \
  --title "Release: <short theme>" \
  --body "Promote the validated develop state to production."
```

The promotion pull request must have a passing `build` check. Human review is
encouraged before merging. Merge it with a merge commit so `main` retains the
ancestry of the validated `develop` history. Do not squash a release
promotion. Production hosting and tagging remain a separate follow-up once
the hosted target exists.
