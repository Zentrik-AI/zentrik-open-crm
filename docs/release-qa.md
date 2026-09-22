# Release QA

This checklist covers the user-visible CRM paths for founders, small B2B teams,
consultants, agencies, and technical operators.

## Required flows

- Start from a clean checkout and understand the demo workspace.
- Create or import one local account and review its contacts, signals, risks,
  value, owner, and next action.
- Capture a source note and see it persist as account memory.
- Create, edit, complete, and filter a next action.
- Search accounts by the fields shown in the app.
- Review an agent proposal and approve or reject it without losing its evidence.
- Export and restore workspace data, then reset the demo workspace.
- Use the primary navigation on a narrow screen without horizontal overflow.
- Open Improve, save a local draft, delete it, and prepare a reviewed public
  bundle without changing CRM records.
- Copy a GitHub issue draft and confirm that it contains only authored feedback.

## Browser coverage

The Playwright suite covers first use, account and contact work, source capture,
local persistence, storage recovery, task ownership, review boundaries,
responsive layout, theme contrast, feedback export, and agent handoff.

Manual QA should additionally check:

- desktop and mobile typography and alignment
- dark and light theme contrast
- accessible names for every form control and button
- no console errors or page-level horizontal overflow
- the launch film's text, timing, and audio at export size

## Commands

```bash
npm run typecheck
npm test
npm run build
npm run test:package
npm run test:e2e
```

Use [Release readiness](./release-readiness.md) for the public-safety,
dependency, hosted-service, legal, and promotion checks.
