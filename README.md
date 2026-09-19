# Zentrik Open CRM

![Zentrik Open CRM product hero](./assets/brand/open-crm-hero.png)

An open-source, local-first CRM for builders who want account work grounded in
real sources, not another place to manually maintain stale records.

[Product Intent](./docs/product-intent.md) ·
[First Use](./docs/first-use.md) ·
[Agent Operator Guide](./docs/agent-operator-guide.md) ·
[Feedback And Support](./docs/feedback-and-support.md) ·
[Roadmap](./docs/roadmap.md) ·
[Brand Archetype](./docs/brand-archetype.md) ·
[Licensing And IP](./docs/licensing-and-ip.md) ·
[Self-Hosting](./docs/self-hosting.md) ·
[Contributing](./CONTRIBUTING.md)

Zentrik Open CRM is built for founders, consultants, agencies, small B2B teams,
and technical operators who sell, support, and build close to their users. It is
useful as a CRM on day one, and it also shows a larger product loop: users
submit feedback, signals become product evidence, agents prepare work, humans
review decisions, and releases are checked against outcomes.

## Why Open CRM

Most lightweight CRMs are easy to start but weak at remembering why an account
matters. Most powerful CRMs become expensive administration systems. Open CRM is
the middle path for small technical teams:

- account memory stays tied to calls, emails, support notes, reviews, usage,
  GitHub, and market signals
- next actions show the source that caused the recommendation
- Claude Code, Codex, and Cursor work the same records you do, through a
  checked command and an MCP server, and you approve what they change
- your data is a folder on your computer: readable, diffable, yours
- users can shape the product through the public Open CRM Buildroom loop

## Quick Start

Needs Node 22.18 or newer.

```bash
git clone https://github.com/Zentrik-AI/zentrik-open-crm.git
cd zentrik-open-crm && npm install

npm run crm -- init ~/crm --demo     # a workspace folder with synthetic records
cd ~/crm
./crm ui                             # the visual CRM, on this folder
```

Drop `--demo` to start empty; the app asks for one real account.

Now open the same folder in your agent:

```bash
cd ~/crm
claude        # or: codex, or open the folder in Cursor
```

Ask it to **run the daily review**. It reads `AGENTS.md`, runs `./crm status`,
reads the accounts that need attention, and proposes next actions that cite the
notes behind them. Each proposal appears in the app under **Review** as it
happens. Nothing changes until you approve it.

Just looking? `npm run dev` opens the browser-only edition at
[http://127.0.0.1:5177](http://127.0.0.1:5177) with no setup. It keeps data in
local storage and can export a one-way Markdown snapshot for an agent to read.

## How People And Agents Share A Workspace

```text
~/crm/
  workspace.json   every record; written only by the app, ./crm, and the MCP server
  AGENTS.md        the operating contract your agent reads first (CLAUDE.md points to it)
  crm              the command: status, show, search, note add, task add, ...
  INDEX.md         generated account index
  accounts/        generated Markdown, one file per account, every record id visible
  inbox/           drop transcripts and emails here; "process the inbox"
  drafts/          customer-facing drafts the agent writes for your review
  playbooks/       daily review, inbox, call prep, follow-up
  .mcp.json        MCP server config for Claude Code (.cursor/mcp.json for Cursor)
```

- **One write path.** The app, the command, and the MCP tools all submit the
  same validated operations. An agent cannot write a malformed record.
- **Review by default.** An agent's change is checked, then held as a proposal.
  You approve or reject it in the app. Switch a workspace to direct mode when
  you trust the loop; every direct change is logged with the agent's name.
- **Grounded work.** Tasks cite the notes behind them. The app draws a solid
  underline under grounded work and a dashed one under a hunch.
- **Notes are evidence, never instructions.** The contract tells agents to
  treat customer text as data, to draft and never send, and to say what is
  missing instead of inventing it.

| Harness | How it connects |
| --- | --- |
| Claude Code | Reads `CLAUDE.md` → `AGENTS.md`, runs `./crm`. Approve the `open-crm` MCP server from `.mcp.json` when asked. |
| Codex | Reads `AGENTS.md`, runs `./crm`. Optional MCP: `codex mcp add open-crm -- ./crm mcp`. |
| Cursor | Reads `AGENTS.md`. The `open-crm` MCP server is preconfigured in `.cursor/mcp.json`. |
| Anything else | If it can run a shell command or speak MCP, it can work the CRM. |

See the [Agent Operator Guide](./docs/agent-operator-guide.md) for the full
loop and the [Workspace Format](./docs/workspace-format.md) for the records,
operations, and MCP tools.

## Product Surface

- Home: what is due, what moved, and what your agents are waiting on you for
- Pipeline, Accounts, Contacts, Tasks, and Notes with source references
- Review: approve or reject what agents proposed, and see what they did
- `crm` command and MCP server over the same workspace folder
- Private and share-safe views, JSON backup, calendar export
- Optional in-app AI with your own Anthropic key
- Improve Open CRM: suggest changes, roadmap, and changelog, kept apart from CRM data

## Development And Release Flow

`develop` is the pre-production branch. Feature branches should start from
`origin/develop` and open pull requests into `develop`. Every push to
`develop` runs the full checks and stores the validated `dist/` bundle as a
short-lived pre-production artifact.

The persistent local sandbox is documented in
[Pre-production And Release](./docs/preproduction-and-release.md). It is the
recommended checkout for reviewing the current `develop` state before release.

Production promotion uses a pull request from `develop` to `main`. `main` is
the production source and remains protected by the `build` check, conversation
resolution, and no-force-push/no-delete rules. Human review is encouraged but
not required while the project is in its early public-product phase. Do not
push feature work directly to `main`.

## Validate Changes

```bash
npm run typecheck
npm test            # core operations, the crm command, MCP, and the local API
npm run build
npm run test:e2e    # browser edition, plus the live agent-to-Review loop on a folder
```

## Current Version

0.2 is a Vite React app with two homes for its data: browser local storage, or
a workspace folder served on loopback by `crm ui`. The repository includes
synthetic demo data only. It has no production API keys or private customer
records.

## Repository Guardrails

This repository is public-product code. Private operating data or customer data
must never enter this repo.

Read [Privacy Boundaries](./docs/privacy-boundaries.md) before importing data or
building integrations.

## License And Trademarks

Zentrik Open CRM is licensed under the
[Apache License 2.0](./LICENSE). Contributions intentionally submitted to this
repository are accepted under the same license unless stated otherwise before
inclusion.

Zentrik AI reserves its trademarks, product names, hosted services, private
APIs, private workspaces, product intelligence systems, runtime credentials, and
proprietary platform code. See [NOTICE](./NOTICE),
[Trademark Policy](./TRADEMARKS.md), and
[Licensing And IP](./docs/licensing-and-ip.md).

## Core Docs

- [Product Intent](./docs/product-intent.md)
- [Product Narrative](./docs/product-narrative.md)
- [Outward Ecosystem](./docs/outward-ecosystem.md)
- [Brand Archetype](./docs/brand-archetype.md)
- [First Use](./docs/first-use.md)
- [Self-Evolving Loop](./docs/self-evolving-loop.md)
- [Feedback And Support](./docs/feedback-and-support.md)
- [Release QA](./docs/release-qa.md)
- [Licensing And IP](./docs/licensing-and-ip.md)
- [Public Release Checklist](./docs/public-release-checklist.md)
- [Roadmap](./docs/roadmap.md)
- [Architecture](./docs/architecture.md)
- [Agent Operator Guide](./docs/agent-operator-guide.md)
- [Workspace Format](./docs/workspace-format.md)
- [Codex Operator Guide](./docs/codex-operator-guide.md)
- [Self-Hosting](./docs/self-hosting.md)
- [Privacy Boundaries](./docs/privacy-boundaries.md)
- [Public Brand Assets](./assets/brand/README.md)

## Public Portal

The first public feedback portal is **Open CRM Buildroom**. Its initial instance
manifest lives in [portal/open-crm-buildroom.instance.json](./portal/open-crm-buildroom.instance.json).

Open CRM Buildroom is where public-safe user requests, votes, release notes, and
outcome checks should make the product's evolution visible.

Use [Feedback And Support](./docs/feedback-and-support.md) to choose the right
channel: Tell Open CRM for contextual feedback, Buildroom for public requests
and votes, GitHub Issues for reproducible open-source work, support requests for
private help, and private vulnerability reporting for security issues.
