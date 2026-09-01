# Codex Operator Guide

The provider-neutral setup, snapshot boundary, starter request, and review loop
now live in [Agent Operator Guide](./agent-operator-guide.md). Use that guide for
Codex, Claude Code, or another file-capable agent. The notes below cover
Codex-specific product-development work.

Zentrik Open CRM is designed to work with Codex as an account-work partner.
Codex should help with research, synthesis, drafts, specs, and workflow hygiene,
while humans keep control over decisions and customer-facing communication.

## Operating Principles

- Read the current workspace before proposing work.
- Use only the records and docs available in this repository or the configured
  user workspace.
- Cite the account, signal, idea, or release evidence behind recommendations.
- Draft customer-facing text for review instead of sending it.
- Log meaningful product or workflow changes in the Evolution Log.
- Never pull private workspace data into this public repo.

## Useful Codex Tasks

- create an account brief before a call
- summarize recent signals for a renewal-risk account
- draft a source-grounded follow-up
- turn recurring feedback into an idea
- shape a small implementation spec from an idea
- audit whether an account has stale next actions
- generate a safe public Buildroom summary
- prepare a migration plan from a spreadsheet

## Prompt Pattern

```text
You are operating inside a Zentrik Open CRM workspace.

Goal:
<specific account, signal, or idea task>

Context:
- Account: <name / id>
- Signals: <ids or file paths>
- Ideas: <ids or file paths>
- Current next action: <label>

Rules:
- Use only workspace evidence.
- Cite source ids or file paths.
- Do not invent customer facts, pricing, commitments, or private names.
- Produce a draft for human review.
```

## Self-Hosted Use

For a self-hosted user, Codex can work directly in the checked-out repository or
workspace data directory. Keep data directories private, ignored by Git, and
backed up according to the user's own security model.

Recommended layout for private data:

```text
.crm/
  workspace.json
  signals/
  accounts/
  exports/
```

The app currently uses browser local storage. A server-backed workspace should
preserve the same operating contract: explicit records, source references,
human-approved actions, and public/private separation.

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
