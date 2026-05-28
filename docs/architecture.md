# Architecture

The first version is intentionally small:

- Vite
- React
- TypeScript
- Tailwind
- browser local storage
- synthetic seed data

The app is structured around a `Workspace` model:

- accounts
- signals
- ideas
- Codex tasks
- evolution log entries

This keeps the core product portable. The same model can later be backed by a
local file store, SQLite, hosted Postgres, or a Zentrik workspace API.

## Current Persistence

Workspace state is loaded from synthetic seed data and persisted to browser
local storage under:

```text
zentrik-open-crm.workspace.v1
```

Settings include export and reset controls so users can inspect or move their
workspace.

## Future Service Boundary

When adding a backend, keep these surfaces separate:

- workspace API: accounts, signals, ideas, tasks, releases
- connector workers: Gmail, calendar, calls, GitHub, reviews, support, usage
- agent runner: task preparation and review workflows
- public Buildroom API: public-safe feedback and release state

The public Buildroom must never expose deal details, raw private notes, private
contact data, or transcripts unless a user explicitly publishes safe summaries.

The first portal instance is defined as a manifest in
[`portal/open-crm-buildroom.instance.json`](../portal/open-crm-buildroom.instance.json).
Agents should translate that manifest into the current portal API or database
contract rather than adding migrations in this repo.

## Styling

The app uses semantic CSS tokens for core product concepts:

- account
- signal
- idea
- agent
- success
- warning
- destructive

Use these tokens when adding UI. Avoid one-off colors unless the token set is
missing a real product concept.
