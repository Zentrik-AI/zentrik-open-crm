# Release QA

This checklist defines the basic CRM surface Open CRM must keep working for the
first ICP: founders, small B2B teams, consultants, agencies, and technical
operators who need account memory without CRM administration overhead.

## Required User Flows

- Start from a clean checkout and understand the demo workspace.
- Create a local account without importing a full CRM.
- Add or review account contacts.
- See account stage, owner, priority, health, fit, value, needs, risks, and next
  action.
- Mark a next action done and see the account workflow update.
- Capture a signal from a call, email, support thread, review, GitHub issue,
  usage note, or market observation.
- Attach that signal to an account and see it persist as account memory.
- Search accounts by name, domain, owner, segment, tags, needs, and risks.
- Switch into Buildroom/public mode and confirm sensitive account details are
  hidden.
- Submit private feedback as a private signal only.
- Submit Buildroom feedback as a public-safe idea candidate plus Codex triage
  task.
- Submit GitHub-shaped feedback as a reproducible public issue candidate plus
  Codex triage task.
- Submit support-shaped feedback as a private support signal plus Codex triage
  task.
- Download the latest `open-crm-feedback.v1` bundle.
- Copy a GitHub issue draft for GitHub-shaped feedback.
- Advance an idea and see the evolution log record why the product moved.
- Copy a guarded Codex prompt that includes explicit context and privacy rules.
- Export the local workspace JSON.
- Reset the demo workspace.
- Use the primary navigation on mobile.

## Current Coverage

The Playwright smoke suite covers:

- desktop first-use workflow
- public/private mode field hiding
- account search empty state
- signal capture
- account creation
- contact creation
- local persistence after reload
- reset behavior
- private feedback routing
- Buildroom feedback routing
- GitHub-shaped feedback routing
- idea advancement
- Codex prompt copy and public-mode safety
- export filename
- mobile primary navigation

Manual browser QA should additionally check:

- desktop Today, Accounts, and Tell Open CRM visual fit
- mobile Today and Accounts visual fit
- absence of page-level horizontal overflow
- no console errors
- all form controls have accessible labels
- all buttons have visible or screen-reader names

## Release Commands

```bash
npm run typecheck
npm run build
npm run test:e2e
```

Also run markdown link and public-data scans before public release.

## Pre-Production Gate

Run the release checks on the current `develop` checkout before opening a
promotion pull request:

```bash
npm ci
npm run typecheck
npm run build
npm run test:e2e
```

For an integrated browser review, use the persistent sandbox described in
[Pre-production And Release](./preproduction-and-release.md). Confirm the
desktop and mobile flows listed above, then open a reviewed `develop` -> `main`
pull request. The `build` check must pass on the promotion commit before
merging.
