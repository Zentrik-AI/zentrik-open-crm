# Zentrik Open CRM

Zentrik Open CRM is an open-source, local-first CRM for source-grounded account
work and agent-assisted follow-up.

It is built for builders, founders, consultants, small B2B teams, and technical
operators who want a CRM that helps them understand what is happening in their
market instead of only storing contacts. It starts as a self-hosted web app and
is designed to support a hosted edition, Zentrik Open CRM Cloud.

## What It Does

- Tracks accounts, stakeholders, deal context, signals, and next actions.
- Links every important recommendation back to source material.
- Gives Codex and similar agents a safe operating surface for account research,
  follow-up preparation, triage, and product feedback synthesis.
- Shows the Open CRM Loop: signals become ideas, ideas become agent work, agent
  work becomes releases, and releases are evaluated against user feedback.
- Keeps local and self-hosted users in control of their data.

## Run Locally

```bash
npm install
npm run dev
```

The app will start at [http://127.0.0.1:5177](http://127.0.0.1:5177).

## Current Version

This first version is a Vite React app with local browser persistence. It
includes synthetic demo data only. It intentionally has no production API keys
or private customer records.

The current surface includes:

- Today board
- Accounts and account detail
- Signal intake
- Open CRM Loop
- Codex task queue
- Settings and export controls

## Repository Guardrails

This repository is public-product code. Private operating data or customer data
must never enter this repo.

Read [Privacy Boundaries](./docs/privacy-boundaries.md) before importing data or
building integrations.

## Core Docs

- [Product Intent](./docs/product-intent.md)
- [Product Narrative](./docs/product-narrative.md)
- [Outward Ecosystem](./docs/outward-ecosystem.md)
- [Architecture](./docs/architecture.md)
- [Codex Operator Guide](./docs/codex-operator-guide.md)
- [Self-Hosting](./docs/self-hosting.md)
- [Privacy Boundaries](./docs/privacy-boundaries.md)

## Public Portal

The first public feedback portal is **Open CRM Buildroom**. Its initial instance
manifest lives in [portal/open-crm-buildroom.instance.json](./portal/open-crm-buildroom.instance.json).
