# Architecture

Open CRM is small on purpose: a React app, a shared core, and a thin Node layer
that puts the same records in reach of coding agents. It has five runtime
dependencies and no database.

```text
src/core/     pure TypeScript shared by everything below
  model.ts      vocabulary: stages, sources, priorities, labels
  ops.ts        the one write path: operations, proposals, review, activity
  validate.ts   structural and referential checks; defaults for older files
  brief.ts      the daily brief: what needs attention, and why
  claims.ts     claims as the source of truth; legacy needs/risks derived from them
  memory.ts     account memory: grounding, who decides, what to ask, trace, lint
  patterns.ts   what several accounts are saying; the signals bundle for a product tool
  markdown.ts   account and index views with record ids
src/          the visual CRM (Vite, React, TypeScript, Tailwind)
cli/          Node only
  store.ts      workspace folder: atomic writes, lock, generated views
  sources.ts    files kept by content hash under sources/, cited by notes
  actions.ts    what the command and MCP can do, as plain functions
  main.ts       the crm command
  mcp.ts        MCP server over stdio, no SDK dependency
  api.ts        loopback HTTP API used by the app in folder mode
  server.ts     crm ui: serves dist/ and the API
  templates.ts  AGENTS.md, playbooks, wrappers written by crm init
bin/open-crm.js plain JavaScript entry; checks the Node version first
```

In a source checkout, Node 22.18+ runs the TypeScript sources directly. Core
modules use explicit `.ts` imports. The npm package compiles the CLI to
`dist/runtime/` because Node does not strip TypeScript under `node_modules`.
`npm run test:package` verifies the installed CLI and UI without development
dependencies or install scripts.

## Two Homes For The Same Workspace

- **Browser.** `npm run dev` or a static host. Records persist to local storage
  under `zentrik-open-crm.workspace.v2`. Agents get a one-way Markdown snapshot.
- **Folder.** `crm ui` serves the same bundle and marks the page as
  folder-backed. The app loads `workspace.json` through the local API, sends
  each change as an operation, and listens for changes agents make.

In both, every CRM mutation is an operation applied by `src/core/ops.ts`. The
app applies it optimistically and, in folder mode, sends the same change to the
server, which applies it again to the file under a lock. Setup, import, and the
Improve corner replace the workspace wholesale, guarded by a content revision
so a concurrent agent write is never overwritten.

See [Workspace Format](./workspace-format.md) for records, operations, views,
and the server's request checks.

## Two Kinds Of Export

Both are files someone chooses to hand over; neither is a second persistence
model.

- **Signals.** `crm export --signals` writes the notes behind a pattern or an
  account as `open-crm-signals.v1` for a product tool. See
  [Account work here, product work in Zentrik](./product-work.md).
- **Feedback.** Improve writes an `open-crm-feedback.v1` envelope about Open CRM
  itself, carrying only what the user typed. See
  [Feedback and support](./feedback-and-support.md).

## If A Hosted Backend Is Added

Keep two surfaces separate: a workspace API that speaks the same operations over
the network, and connector workers that land sources as notes with references
through `note.add`. Neither may weaken the review gate or let private account
fields reach anything share-safe.

## Styling

The app uses semantic CSS tokens for product concepts: account, signal, highlight,
agent, success, warning, destructive. Violet is reserved for agents. Use the
tokens when adding UI; avoid one-off colors unless the set is missing a real
concept.
