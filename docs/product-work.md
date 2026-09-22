# Account work here, product work in Zentrik

Open CRM keeps account memory. The app, the `crm` command, and the MCP server
are useful on their own, with no hosted service and no account anywhere.

```text
source → account memory → next action → review → outcome
```

## What stays local

- accounts, contacts, pipeline, tasks, notes, and next actions
- claims and their evidence, the brief, the trace
- browser storage or a workspace folder you own
- synthetic fixtures and portable exports
- the CLI and MCP handoff for coding agents

Start with demo data, an empty workspace, or a folder. Nothing here needs a
hosted service for first value.

## When evidence becomes a product decision

The CRM notices when several accounts say the same thing — that is the Book's
patterns — and stops there. Deciding what to build from that evidence is
product work, and [Zentrik](https://zentrik.ai) is built for it.

The handoff carries sources, never conclusions. `crm export --signals` writes
the notes behind a pattern or an account as `open-crm-signals.v1`, plus one
Markdown file per source, share-safe on request; a person imports them in
Zentrik. An agent with the Zentrik MCP connected can ingest the same bundle
directly, entry by entry, each note keeping its stable identity so retries do
not duplicate. Nothing leaves the workspace unless someone asks, and the CRM
works exactly the same if Zentrik is never used.

## Feedback about Open CRM itself

A separate path. **Improve** prepares a local draft and, when you choose to
share it, a public-safe bundle or a GitHub issue that you submit yourself.
Nothing is sent automatically. See
[Feedback and support](./feedback-and-support.md).

## Public boundary

Never publish account records, private notes, credentials, raw transcripts, or
unreviewed customer evidence. A request is evidence to weigh, not a roadmap
promise.
