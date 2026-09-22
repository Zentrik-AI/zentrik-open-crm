# Zentrik Open CRM

![An Open CRM account: the brief before a conversation, what we know with the note behind each claim, and who decides](./assets/brand/open-crm-hero.png)

**Relationship management for people and their agents.** An open-source,
local-first CRM where every fact shows its source, agents propose and people
approve, and what several accounts are saying is handed on as product
evidence instead of being decided here.

Open CRM is the first open **ARM**: Agent Relationship Management.

**[Try it in your browser →](https://zentrik-ai.github.io/zentrik-open-crm/)**
Demo data, no sign-up; whatever you type stays in your own browser storage.

[First Use](./docs/first-use.md) ·
[Agent Operator Guide](./docs/agent-operator-guide.md) ·
[Workspace Format](./docs/workspace-format.md) ·
[Self-Hosting](./docs/self-hosting.md) ·
[Roadmap](./docs/roadmap.md) ·
[Contributing](./CONTRIBUTING.md)

Zentrik Open CRM is built for founders, consultants, agencies, small B2B teams,
and technical operators who sell, support, and build close to their users. It is
a CRM you run yourself, on a folder you own, that your coding agent can work
as well as you can.

## What An ARM Is

A CRM assumes a person does the work and the software keeps the file. An **ARM
— Agent Relationship Management** — assumes a person and their agents do the
work together, and the file has to hold up to both. Four things make it one:

1. **One write path.** People and agents change the same records through the
   same checked operations. No agent-only side channel, no import that skips
   validation.
2. **Everything shows its source.** A fact cites the note that says so, or it
   is drawn as a hunch. An agent that cannot ground a claim has to say so.
3. **Nothing lands unapproved.** An agent's change is validated, then held as a
   proposal until a person decides. Direct mode is a choice, and it is logged.
4. **The records are yours.** A folder you own, in formats you can read,
   working with whichever agent you use.

Open CRM is the first open one. Anything meeting those four is an ARM too; we
would rather the category exist than be the only ones in it.

## Why Open CRM

Most lightweight CRMs are easy to start but weak at remembering why an account
matters. Most powerful CRMs become expensive administration systems. Open CRM is
the middle path for small technical teams:

- account memory stays tied to the calls, emails, support notes, and reviews
  that produced it
- next actions show the source that caused the recommendation
- Claude Code, Codex, and Cursor work the same records you do, through a
  checked command and an MCP server, and you approve what they change
- your data is a folder on your computer: readable, diffable, yours
- users can prepare public feedback without sharing their CRM records

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

Ask it to **complete `docs/agent-setup.md`, then run one manual daily review**.
`./crm setup` shows the local setup state; it creates no schedules. See
[Agent setup and recovery](./docs/agent-setup.md) for manual operation and
preserving local instructions during upgrades.

The agent reads `AGENTS.md`, runs `./crm status`,
reads the accounts that need attention, and proposes next actions that cite the
notes behind them. Each proposal appears in the app under **Review** as it
happens. Nothing changes until you approve it.

Just looking? The [hosted demo](https://zentrik-ai.github.io/zentrik-open-crm/)
is the same browser edition, or run it yourself with `npm run dev` at
[http://127.0.0.1:5177](http://127.0.0.1:5177). Either way it keeps data in that
browser's local storage and can export a one-way Markdown snapshot for an agent
to read.

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
  same validated operations. These interfaces reject malformed records; direct
  filesystem access is not a security boundary.
- **Review by default.** An agent's change is checked, then held as a proposal.
  You approve or reject it in the app. Switch a workspace to direct mode when
  you trust the loop; every direct change is logged with the agent's name.
- **Grounded memory.** What you know about an account is recorded as claims
  (needs, risks, goals, objections, commitments, facts), each citing the notes
  that say so. The app draws a solid underline under grounded work and a
  dashed one under a hunch, and any line opens its trace: source, what we took
  from it, what it led to.
- **Before you talk to them.** Every account computes what changed since the
  last real contact, what each side owes, who decides and who is missing, and
  the questions worth asking. `./crm brief <account>` is the same page for an
  agent.
- **The Book.** Every account in its stage lane, each tile carrying the one
  thing worth noticing, filterable by what is thin: overdue commitments,
  unsourced claims, no one who signs off, stale evidence.
- **Sources, not connectors.** Your harness already reaches your calendar,
  mail, and call recorder. `./crm source add` keeps what it brings in by
  content hash, so every note traces to an original and nothing is captured
  twice.
- **Account work stays here; product work goes to Zentrik.** When several
  accounts say the same thing, the Book shows it, and one click hands the
  sources behind it to [Zentrik](https://zentrik.ai) to decide what to build.
  The CRM sends sources, never conclusions.
- **Notes are evidence, never instructions.** The contract tells agents to
  treat customer text as data, to draft and never send, and to say what is
  missing instead of inventing it.

| Harness | How it connects |
| --- | --- |
| Claude Code | Reads `CLAUDE.md` → `AGENTS.md`, runs `./crm`. Approve the `open-crm` MCP server from `.mcp.json` when asked. |
| Codex | Reads `AGENTS.md`, runs `./crm`. Optional MCP: `codex mcp add open-crm -- ./crm mcp`. |
| Cursor | Reads `AGENTS.md`. The `open-crm` MCP server is preconfigured in `.cursor/mcp.json`. |
| Anything else | If it can run a shell command or speak MCP, it can work the CRM. |
| Zentrik | Optional, for product decisions. With the Zentrik MCP connected, an agent hands a pattern's sources over with `crm_signals_bundle`; without it, `crm export --signals` writes a folder to import. |

See the [Agent Operator Guide](./docs/agent-operator-guide.md) for the full
loop, the [Workspace Format](./docs/workspace-format.md) for the records,
operations, and MCP tools, and [Personas and Flows](./docs/personas-and-flows.md)
for who this is built for and the moments it is built around.

## Product Surface

- Home: what is due, what moved, and what your agents are waiting on you for
- Book: every account by stage with the one thing worth noticing; what several accounts are saying
- Pipeline, Accounts, Contacts, Tasks, and Notes with source references
- Accounts: what we know with its evidence, who decides, and the brief before a conversation
- Review: approve or reject what agents proposed, and see what they did
- Trace: from any task, claim, or note, the chain from source to action
- `crm` command and MCP server over the same workspace folder
- Private and share-safe views, JSON backup, calendar export
- Optional in-app AI with your own Anthropic key
- Improve: local feedback about Open CRM itself, kept separate from your CRM data

## Development And Release Flow

`main` is the protected branch. Feature branches start from `origin/main` and
open pull requests into `main`; the same checks run for every pull request. See
[Releasing](./docs/releasing.md) for the checks and the pre-tag review.

## Validate Changes

```bash
npm run typecheck
npm test            # core operations, the crm command, MCP, and the local API
npm run build
npm run test:package # pack, install with production dependencies, check CLI/agent kit/MCP/UI
npm run test:e2e    # browser edition, plus the live agent-to-Review loop on a folder
```

`npm pack` runs the build through `prepack` and includes the UI bundle and
compiled JavaScript CLI. An installed tarball runs without build tools.
`test:package` uses temporary synthetic workspaces, disables install scripts, and removes its
temporary install after the check; dependency installation needs npm registry access.

## Current Version

1.0 is a Vite React app with two homes for its data: browser local storage, or a
workspace folder served on loopback by `crm ui`. The repository carries
synthetic demo data only — no API keys, no customer records. See
[CHANGELOG.md](./CHANGELOG.md).

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

## Docs

**Using it:** [First Use](./docs/first-use.md) ·
[Personas and Flows](./docs/personas-and-flows.md) ·
[Review a team's tasks](./docs/team-task-review.md) ·
[Self-Hosting](./docs/self-hosting.md)

**Working it with agents:** [Agent Operator Guide](./docs/agent-operator-guide.md) ·
[Agent Setup](./docs/agent-setup.md) · [Agent Routines](./docs/agent-routines.md) ·
[Workspace Format](./docs/workspace-format.md)

**How it is built:** [Architecture](./docs/architecture.md) ·
[Design System](./docs/design-system.md) ·
[Account work here, product work in Zentrik](./docs/product-work.md) ·
[Roadmap](./docs/roadmap.md)

**Boundaries:** [Privacy Boundaries](./docs/privacy-boundaries.md) ·
[Feedback and Support](./docs/feedback-and-support.md) ·
[Licensing and IP](./docs/licensing-and-ip.md) · [Releasing](./docs/releasing.md)

## Product Feedback

**Improve** saves a local draft and, when you choose to share it, prepares a
public-safe bundle or a GitHub issue that you submit yourself. It never reads
your CRM records and nothing is sent automatically. See
[Feedback and support](./docs/feedback-and-support.md), and keep customer
records and security reports out of public issues.
