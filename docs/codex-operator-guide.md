# Codex Operator Guide

Setup, the review loop, and the operating contract live in the
[Agent Operator Guide](./agent-operator-guide.md). They are the same for Codex,
Claude Code, and Cursor.

Codex specifics:

- Codex reads `AGENTS.md` from the workspace folder and runs `./crm` directly.
- To use the MCP tools as well: `codex mcp add open-crm -- ./crm mcp`, run from
  the workspace folder.
- Changes Codex makes are recorded under the name `codex`. Set
  `OPEN_CRM_ACTOR` to use another name.

## Delivery Branches

Use `develop` as the pre-production integration branch. Start durable worktrees
from `origin/develop`, open implementation pull requests into `develop`, and
review the persistent sandbox before requesting production promotion.

The production path is a `develop` -> `main` pull request. Keep `main`
protected by its build and history controls; human review is encouraged but not
required for now. Do not use `main` as an agent scratch branch. The shared
worktree lifecycle is the canonical path for a sandbox checkout:

```bash
zentrik-agent-workflows/bin/zentrik-worktree --repo zentrik-open-crm create \
  --slug open-crm-develop-sandbox --base origin/develop
zentrik-agent-workflows/bin/zentrik-worktree --repo <sandbox> up --profile sandbox
```

Stop the managed runtime with the matching `down` command before removing or
refreshing the sandbox. Never copy private CRM data into this repository.
