# Self-Hosting

## On Your Computer, With Agents

```bash
npm install
npm run crm -- init ~/crm
cd ~/crm && ./crm ui
```

`crm ui` builds the app when needed and serves it, with the workspace API, on
`127.0.0.1` only. Data lives in `~/crm/workspace.json`. Back the folder up like
any other, or keep it under git. See the
[Agent Operator Guide](./agent-operator-guide.md).

The local server has no login because it is reachable only from your own
machine and answers only its own page. Do not put it behind a public reverse
proxy.

## As A Static Site, Browser Only

```bash
npm run build
```

Serve `dist/` with any static host. Each visitor's data stays in their own
browser's local storage. Use Settings → Local data to export a JSON backup.

## Environment

Copy `.env.example` to `.env.local` when adding local settings.

Never commit `.env.local`, real API keys, connector credentials, or private
workspace URLs.

## Hosted Edition

Zentrik Open CRM Cloud should preserve the same product contract:

- users can understand where recommendations came from
- humans approve customer-facing work
- public Buildroom data is explicitly separated from private CRM data
- exports remain possible

## Development and release

Contributors work from feature branches based on `main` and open reviewed pull
requests back to `main`. See [Pre-production and release](./preproduction-and-release.md)
for the repository workflow.
