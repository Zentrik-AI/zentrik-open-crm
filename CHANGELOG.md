# Changelog

All notable public-product changes should be recorded here.

This project follows a lightweight changelog until the first tagged release.

## Unreleased

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
