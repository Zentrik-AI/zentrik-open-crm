# Self-Hosting

The first version runs entirely in the browser.

```bash
npm install
npm run dev
```

Build a static production bundle with:

```bash
npm run build
```

Then serve the `dist/` directory with any static host.

## Data

The first version stores data in browser local storage. Use the export control
to download a JSON copy of the workspace.

Future self-hosted deployments should move data into a private `.crm/` directory
or database that is not committed to Git.

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
