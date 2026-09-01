# Agent Operator Guide

Zentrik Open CRM works with Codex, Claude Code, and other file-capable agents.
The agent prepares source-grounded work. A human reviews the evidence, approves
the action, and records the accepted result in the visual CRM.

## The Data Boundary

The app stores its working data in the browser. A CLI agent cannot read that
local storage simply because it runs in the Open CRM code repository.

Create an explicit bridge in **Settings → Agent workspace**:

1. Choose a dedicated private folder and sync the current workspace to it. If
   direct folder access is not available, download the Markdown snapshot and
   move it into a private working folder.
2. Open a terminal in that snapshot folder.
3. Start the agent there and ask it to read `_agent-guide.md`, `_index.md`, and
   the account files.
4. Review the result, then add accepted actions or notes in the visual CRM.
5. Sync again before the next agent session.

The Markdown files are a one-way snapshot. Editing them does not update the
browser workspace. Keep the snapshot private, out of this public repository,
and inside the user's own backup and access-control boundary.

## Start Codex

Install and authenticate Codex using the current official instructions, then:

```bash
cd /path/to/open-crm-workspace
codex
```

Codex reads `AGENTS.md` files from the directory hierarchy. The exported
snapshot uses `_agent-guide.md` so it does not overwrite instructions that
already exist in a chosen folder. Explicitly tell Codex to read that guide.

## Start Claude Code

Install and authenticate Claude Code using the current official instructions,
then:

```bash
cd /path/to/open-crm-workspace
claude
```

Claude Code reads `CLAUDE.md`, not `AGENTS.md`. In this product repository,
`CLAUDE.md` imports the shared `AGENTS.md` so engineering guidance has one source
of truth. In an exported CRM snapshot, explicitly tell Claude to read
`_agent-guide.md`.

## A Reliable Request Shape

State the outcome, evidence, boundaries, success criteria, and review format.
This request works across file-capable agents:

```text
Read _agent-guide.md, _index.md, and the CRM account Markdown files in this directory.

Goal: prepare my first source-grounded CRM review for today.

Success criteria:
- Identify the accounts that need attention, using only recorded workspace evidence.
- Cite the account file, source-note title, and source reference behind each recommendation.
- Separate recorded facts from your inferences and state what is missing or uncertain.
- Propose no more than three prioritized next actions, each with an owner and reason.
- Draft customer-facing text only when useful and label it for human review.

Boundaries:
- Do not contact anyone, send messages, or make external changes.
- Do not modify the snapshot files unless I explicitly ask you to.
- Return a concise review for approval before any action.
```

## Useful Follow-Up Requests

- “Review `acme-studio.md`. Prepare a five-minute call brief and cite every
  source note you use.”
- “Find open tasks whose evidence is missing or stale. Explain the gap; do not
  invent context.”
- “Draft a follow-up from the latest call note. Mark facts, inferences, and
  questions separately. Do not send it.”
- “Compare the last three source notes for this account. Show what changed and
  propose one next action for approval.”
- “Turn repeated source-backed needs into candidate product ideas. Preserve the
  note titles and source references.”

## Review Checklist

Before accepting agent work, confirm:

- each recommendation cites a file and source reference
- facts and inferences are visibly separate
- missing evidence is stated
- no customer commitment, price, or personal detail was invented
- external actions remain unexecuted
- accepted next actions are recorded in the visual CRM

## Public Repository Work

When an agent changes the Open CRM product itself, it must follow `AGENTS.md`,
use synthetic data only, and run the repository validation commands. Private
snapshot folders must never be added to this public repository.
