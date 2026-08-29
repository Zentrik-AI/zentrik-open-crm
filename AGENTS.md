# Zentrik Open CRM Agent Instructions

This repository is the public, open-source CRM product. It must stay clean of
private operating data and private customer data.

Use product context, source structure, and UI patterns as inspiration, but do
not copy private records, private conversations, account notes, connector
content, API responses, private IDs, or customer names from any private
workspace.

## Hard Boundaries

- Do not commit API keys, session tokens, cookies, private workspace URLs,
  production identifiers, customer names, transcripts, email bodies, meeting
  notes, or screenshots containing private data.
- Sample records must be synthetic, clearly fictitious, and use safe domains
  such as `.invalid`, `.example`, or `example.com`.
- If a feature needs realistic source material, use public sources, cite the
  source in documentation when needed, and summarize or synthesize rather than
  copying protected content.
- Do not copy private Zentrik app code, hosted-service internals, production
  workspace contracts, proprietary insight logic, or private orchestration
  systems into this public repository.

## Product Direction

Build a real CRM, not a marketing shell. The first screen should be usable for
account work: accounts, signals, next actions, source confidence, ideas, and
agent tasks.

The product should feel source-grounded, human-centered, agent-assisted, and
designed for teams that want a self-managed CRM they can run locally or use
through a hosted edition.

## Engineering Defaults

- Prefer small, explicit data models that can later move from local storage to a
  server-backed workspace without rewriting the product.
- Preserve local-first behavior unless the current task explicitly changes the
  persistence model.
- Keep docs direct and useful for agents. Avoid bloated conceptual repetition.
- End agent-authored PRs with the `Agents:` trailer from
  `.github/pull_request_template.md`. Build exactly one `Agents:` line with
  one entry per tool that edited the branch. Use
  `Tool ([Conversation title](tested-url))`; without a tested URL use
  `Tool (Conversation title)`, and use `Tool` alone only when the title is
  unavailable. Join entries with comma + space in first-edit order and do not
  leave a trailing comma. Use only the tested URL forms listed in the template.
  Never use raw custom schemes, invent a chat URL, or turn a local ID into a
  cloud URL. Delete the line when no agent edited the PR. Keep contract copy on
  one PR per repo, and update only `Agents:` on feature PRs you own. Sibling
  repos use `Agents:` only; do not add app-only trailers. Keep Claude
  configuration as a thin `AGENTS.md` import plus attribution suppression. Do
  not duplicate this grammar in Cursor rules because Cursor reads the root
  `AGENTS.md`.
- Use semantic tokens and accessible controls. Do not add decorative visual
  noise that makes daily CRM work harder.
- Keep `LICENSE`, `NOTICE`, `TRADEMARKS.md`, and
  `docs/licensing-and-ip.md` aligned when changing the open-source boundary.

## Branch And Sandbox Workflow

- Treat `develop` as the pre-production integration branch and start new work
  from `origin/develop`.
- Open feature pull requests against `develop`. Keep `main` for reviewed
  production promotion from `develop`.
- Use the shared Zentrik worktree command and the repository profile in
  `.zentrik/worktree.json` for durable worktrees. Do not create ad hoc durable
  worktrees or choose random ports.
- The persistent sandbox runs the current `develop` checkout. Before reviewing
  it, fetch `origin/develop` and fast-forward the sandbox only when its working
  tree is clean.
- Run `npm run typecheck`, `npm run build`, and `npm run test:e2e` before
  proposing production promotion. Do not treat a passing local build as a
  substitute for the protected `main` review.
