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
  markdown.ts   account and index views with record ids
src/          the visual CRM (Vite, React, TypeScript, Tailwind)
cli/          Node only
  store.ts      workspace folder: atomic writes, lock, generated views
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

## Feedback Bundles

Tell Open CRM produces an `open-crm-feedback.v1` bundle for local and
self-hosted users. It is a portable envelope that can be copied into GitHub or
passed through an optional, maintainer-operated product-evidence adapter. It is
not a second persistence model.

## Future Service Boundary

When adding a hosted backend, keep these surfaces separate:

- workspace API: the same operations, over the network
- connector workers: email, calendar, calls, GitHub, reviews, support, usage.
  Each lands sources as notes with references, through `note.add`
- public Buildroom API: public-safe feedback and release state
- feedback intake API: hosted `open-crm-feedback.v1` submissions

The public Buildroom must never expose deal details, raw private notes, private
contact data, or transcripts unless a user explicitly publishes safe summaries.
The first portal instance is defined in
[`portal/open-crm-buildroom.instance.json`](../portal/open-crm-buildroom.instance.json).

## Styling

The app uses semantic CSS tokens for product concepts: account, signal, idea,
agent, success, warning, destructive. Violet is reserved for agents. Use the
tokens when adding UI; avoid one-off colors unless the set is missing a real
concept.
