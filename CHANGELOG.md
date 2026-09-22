# Changelog

All notable public-product changes should be recorded here.

This project follows a lightweight changelog until the first tagged release.

## Unreleased

## 1.0.0

- Add the Book: every account in its stage lane, each tile carrying the one
  thing worth noticing, with filters for overdue commitments, unsourced claims,
  missing deciders, stale evidence, and no verified contact.
- Add patterns: what several accounts are saying, grouped on shared terms and
  shown with the accounts, claims, and sources behind them. `crm patterns` and
  `crm_patterns` for agents.
- Add the product-work handoff: `crm export --signals` and `crm_signals_bundle`
  write the sources behind a pattern or an account as `open-crm-signals.v1`
  plus one Markdown file per source, share-safe on request, for Zentrik to
  turn into product decisions. The CRM sends sources, never conclusions.
- Add durable sources: `crm source add` keeps a file under `sources/` by
  content hash with its external id and date; notes cite it as
  `source:<id>` and the trace reaches the original.
- Add the `pull-sources` and `product-work` playbooks; the inbox playbook keeps
  files as sources first.
- A contact can be the focus of a trace: what they said, what we know from it.
- Put the product name in one place (`src/lib/brand.ts`); see `docs/naming.md`.

- Add claims: what we know about an account as typed facts (needs, risks,
  goals, objections, commitments, facts), each citing the notes that say so.
  Legacy needs and risks migrate on first read and stay derived from claims.
- Add the account memory: what changed since the last verified contact, what
  each side owes, who decides and which roles are missing, and the questions
  worth asking. Shown on the account as *Before you talk to them*, and as
  `crm brief` / `crm_brief` for agents.
- Add the evidence trace: from any task, claim, or note, the chain from source
  to action, opened from the grounding underline or `crm why`.
- Add `crm lint` / `crm_lint`: hunches, stale evidence, overdue commitments,
  missing economic buyers and champions, contacts never seen.
- Replace the contacts list on an account with a buying-committee map; an
  empty lane is drawn as the question to ask.
- Generated Markdown views list what we know with evidence ids.
- Add `docs/personas-and-flows.md`.

## 0.2.0

- Add workspace folders: `crm init` creates a folder whose `workspace.json` is
  the source of truth, with generated Markdown views that carry every record id.
- Add the `crm` command and an MCP server over stdio so Claude Code, Codex,
  Cursor, and other agents can read accounts, capture sourced notes, and
  propose next actions. No new runtime dependencies.
- Add review mode: an agent's change is validated, held as a proposal, and
  applied only when a person approves it. Direct mode applies and logs instead.
- Add the Review view, live updates from the folder, and a Home strip when
  changes are waiting.
- Show grounding on tasks: the agent's name, its reason, and a solid underline
  for cited notes or a dashed one for a hunch.
- Move every CRM mutation onto one validated operations layer shared by the
  app, the command, and MCP.
- Validate imported backups fully instead of checking one field.
- `crm init` writes AGENTS.md, CLAUDE.md, playbooks, an inbox, and MCP config
  for Claude Code and Cursor.
- Add unit tests for the core, the command, MCP, and the local API, and an
  end-to-end test of the agent-to-Review loop. Require Node 22.18+.
- Offer the current Claude models for the optional in-app AI.

## 0.1.x

- Strengthen public repository onboarding, roadmap, and contribution surfaces.
- Clarify the first-use workflow for local users.
- Add an in-product first-use panel that routes users through accounts, signal
  capture, Codex tasks, and the Open CRM Loop.
- Add a Tell Open CRM feedback surface with private-signal, Buildroom-request,
  and GitHub-issue modes.
- Add support request routing to Tell Open CRM so private setup and hosted-account
  issues become support signals plus Codex triage tasks.
- Connect Buildroom and GitHub-shaped feedback to local signal, idea, Codex task,
  and evolution-log artifacts.
- Add downloadable `open-crm-feedback.v1` bundles and copyable GitHub issue
  drafts for local/self-hosted feedback.
- Document the feedback and support channels that feed the Zentrik Open CRM
  workspace.
- Reset scroll position between workspace views so feedback-to-loop transitions
  open cleanly at the start of the destination surface.
- Add Signal Workshop brand archetype docs and public assets for README, social
  previews, launch posts, articles, email banners, Buildroom, and product
  screenshots.
- Add public issue and pull request templates.

## 0.1.0

- Initial local-first CRM surface with synthetic demo data.
- Today board, accounts, signal intake, Open CRM Loop, Codex task queue, public
  mode, export, and reset controls.
