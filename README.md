# Zentrik Open CRM

[![Checks](https://github.com/Zentrik-AI/zentrik-open-crm/actions/workflows/checks.yml/badge.svg?branch=main)](https://github.com/Zentrik-AI/zentrik-open-crm/actions/workflows/checks.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-0f766e.svg)](./LICENSE)
[![Node 22.18+](https://img.shields.io/badge/node-22.18%2B-0f766e.svg)](https://nodejs.org)
[![Latest release](https://img.shields.io/github/v/release/Zentrik-AI/zentrik-open-crm?color=0f766e&label=release)](https://github.com/Zentrik-AI/zentrik-open-crm/releases)

**Relationship management for people and their agents.** An open-source,
local-first CRM where every fact shows its source, agents propose and people
approve, and your records stay in a folder you own.

Open CRM is the first open **ARM**: Agent Relationship Management.

### [▶ Try it in your browser](https://zentrik-ai.github.io/zentrik-open-crm/)

The real browser edition with demo data. No sign-up, no install, and whatever
you type stays in your own browser storage.

![An Open CRM account: the brief before a conversation, what we know with the note behind each claim, and who decides](https://raw.githubusercontent.com/Zentrik-AI/zentrik-open-crm/main/assets/brand/open-crm-hero.png)

We built this for ourselves. Open CRM carries the way we run our own accounts
at Zentrik, the same operating model we depend on every day, published as its
own product rather than described in a blog post.

---

## Start in two minutes

You need [Node 22.18 or newer](https://nodejs.org) (`node -v` to check). No
database, no account, no API key.

```bash
git clone https://github.com/Zentrik-AI/zentrik-open-crm.git
cd zentrik-open-crm && npm install

npm run crm -- init ~/crm --demo     # a workspace folder with synthetic records
cd ~/crm && ./crm ui                 # the visual CRM, on that folder
```

The app opens at `http://127.0.0.1:5178`. Use `./crm ui --port 5200` if that
port is taken, and `crm.cmd` instead of `./crm` on Windows.

Drop `--demo` to start empty; the app then asks for one real account.

**Now hand the same folder to your agent:**

```bash
cd ~/crm
claude        # or: codex, or open the folder in Cursor
```

Ask it to **run the daily review**. It reads `AGENTS.md`, runs `./crm status`,
looks at the accounts that need attention, and proposes next actions that cite
the notes behind them. Each proposal appears in the app under **Review** as it
happens, and nothing changes until you approve it.

Three more worth asking on day one:

- *"Process the inbox"* after you drop a transcript or email into `inbox/`.
- *"Prepare me for the Northstar call"* before a conversation.
- *"Where is our memory thin?"* to get `./crm lint` in plain words.

## Every fact shows its source

What you know about an account is recorded as **claims**: needs, risks, goals,
objections, commitments, facts. Each one cites the notes that say so. A claim
without evidence is drawn as a hunch, everywhere it appears.

Click any grounded line and the trace opens: the source, what we took from it,
and what it led to.

![Clicking a grounded claim opens its trace: the note and person it rests on, and the action it supports](https://raw.githubusercontent.com/Zentrik-AI/zentrik-open-crm/main/assets/demo/trace.gif)

That is the whole bargain. An agent can write into these records, and you can
always ask where a line came from.

## A table when the question is a comparison

Accounts has a list for recognizing an account beside its detail, and a table
for comparing them: value, last verified contact, how much of what you know is
grounded, what is due next. Unknown values sort last in both directions,
because reversing a sort should never promote a record nobody has confirmed.

![Switching Accounts to the table view and sorting by value, then by grounding](https://raw.githubusercontent.com/Zentrik-AI/zentrik-open-crm/main/assets/demo/table.gif)

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
- private by design, and yours to change: the model is small enough to read in
  an afternoon, so you can shape it to how you understand your customers
- sorted tables when you want to compare accounts, and the brief, the trace,
  and the Book when a table is the wrong shape for the question

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
  docs/            the agent setup and routine contract, installed locally
  sources/         appears with your first `./crm source add`; files kept by content hash
  .mcp.json        MCP server config for Claude Code (.cursor/mcp.json for Cursor)
```

- **One write path.** The app, the command, and the MCP tools all submit the
  same validated operations. These interfaces reject malformed records; direct
  filesystem access is not a security boundary.
- **Review by default.** An agent's change is checked, then held as a proposal.
  You approve or reject it in the app. Switch a workspace to direct mode when
  you trust the loop; every direct change is logged with the agent's name.
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
- Table: every account on one grid, sorted by value, last contact, grounding, or what is due
- Review: approve or reject what agents proposed, and see what they did
- Trace: from any task, claim, or note, the chain from source to action
- `crm` command and MCP server over the same workspace folder
- Private and share-safe views, JSON backup, calendar export
- Optional in-app AI with your own Anthropic key
- Improve: local feedback about Open CRM itself, kept separate from your CRM data

## Your Data

Everything lives in the workspace folder you created. `workspace.json` is the
whole record set; the Markdown beside it is generated from that file and safe to
delete. Back it up by copying the folder, or keep it in git and get a history of
every change for free.

The browser-only edition (`npm run dev`, or the
[hosted demo](https://zentrik-ai.github.io/zentrik-open-crm/)) keeps records in
that browser's local storage instead. A CLI agent cannot see them; use
**Settings → Agent workspace** to export a one-way Markdown snapshot, or move to
a folder workspace when you want the agent loop.

Nothing is sent anywhere. There is no account and no telemetry, and the app makes
no outbound request at all unless you add your own Anthropic key for the optional
in-app AI, which then talks to Anthropic and nobody else.

## If Something Goes Wrong

| Symptom | What it means |
| --- | --- |
| `Open CRM needs Node 22.18 or newer` | Install a current Node from [nodejs.org](https://nodejs.org), then rerun. |
| `Port 5178 is not available. Pass --port <number>.` | Something else holds the port: `./crm ui --port 5200`. |
| The agent cannot find your accounts | It is reading a folder workspace; the browser edition's data is in the browser. Run `./crm init` and work from that folder. |
| `./crm` is not executable | On Windows use `crm.cmd`. On macOS or Linux, `chmod +x crm`. |
| A proposal will not approve | It builds on an earlier proposal, or the record changed since it was prepared. Review shows which; approve them in order, or reject and ask again. |

Anything else, [open a discussion](https://github.com/Zentrik-AI/zentrik-open-crm/discussions)
with what you ran and what happened.

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
[Launch film brief](./docs/launch-film-creative-brief.md) ·
[Account work here, product work in Zentrik](./docs/product-work.md) ·
[Roadmap](./docs/roadmap.md)

**Boundaries:** [Privacy Boundaries](./docs/privacy-boundaries.md) ·
[Feedback and Support](./docs/feedback-and-support.md) ·
[Licensing and IP](./docs/licensing-and-ip.md) · [Releasing](./docs/releasing.md)

## Contributing

Issues and pull requests are welcome, and so is telling us where the first five
minutes were confusing. Start with [CONTRIBUTING.md](./CONTRIBUTING.md), and run
the checks before opening a pull request:

```bash
npm run typecheck
npm test             # core operations, the crm command, MCP, the local API
npm run build
npm run test:package # pack, install without dev dependencies, check CLI/MCP/UI
npm run test:e2e     # the browser edition and the agent-to-Review loop on a folder
```

`main` is protected and every pull request runs the same checks. See
[Releasing](./docs/releasing.md).

## Product Feedback

**Improve** saves a local draft and, when you choose to share it, prepares a
public-safe bundle or a GitHub issue that you submit yourself. It never reads
your CRM records and nothing is sent automatically. See
[Feedback and support](./docs/feedback-and-support.md), and keep customer
records and security reports out of public issues.

## Repository Guardrails

This repository is public product code. Private operating data and customer data
must never enter it. Read [Privacy Boundaries](./docs/privacy-boundaries.md)
before importing data or building an integration, and report vulnerabilities
through [SECURITY.md](./SECURITY.md) rather than a public issue.

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
