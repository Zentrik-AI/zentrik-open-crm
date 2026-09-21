# Trust and agent setup release review

This change prepares the local product for repeated human-and-agent use. It does
not enable a scheduler, publish npm, change repository visibility, or certify the
separate [public release checklist](public-release-checklist.md).

## Acceptance and evidence

| Boundary | Executable proof |
| --- | --- |
| Unknown scores, actual contact dates, duplicate work, stale and dependent proposals | `tests/unit/trust.test.ts` |
| Invalid imports and valid legacy records | `tests/unit/import-validation.test.ts` |
| Same-host writers, revision conflicts, immutable backups, marked generated views, reconnects | `tests/unit/store-safety.test.ts` |
| Corrupt, denied or full browser storage and explicit recovery | `tests/unit/browser-storage.test.ts` |
| Cold setup, manual mode, reviewed retries, preservation of edited guides | `tests/unit/agent-onboarding.test.ts` |
| Task edit/wait/cancel, account archive/restore, stale review, recovery, mobile and folder loop | `tests/e2e/smoke.spec.ts`, `tests/e2e/folder.spec.ts` |
| Installed tarball without development tools or install scripts | `npm run test:package` |

Run typecheck, unit tests, build, package smoke and browser tests before merge.
CI retains synthetic browser screenshots and failure traces as the
`open-crm-browser-evidence` artifact. No live records or credentials are used.
Package smoke starts a temporary loopback server and removes only its own
temporary fixture directory. No native schedules or external messages are made.

## Frontend design review

User and job: a small team's operator edits existing work, reviews proposed
changes and recovers saved records without losing context or history.

Must be noticed first: who owns the task, what its state means, whether evidence
is unknown, and whether a change can safely be saved or approved.

Selected and reused: existing inline forms, semantic tokens, progressive account
maintenance disclosure and the centered folder-error recovery pattern. Waiting
uses a review date; archive keeps an inspectable account; conflict review shows
current and proposed values. The false historical sparkline was removed.

Alternative and design-language exploration: exempt for these narrow repairs
to mature forms, review cards and error states. Navigation, typography and the
product's visual character remain unchanged. No external design reference was
needed, and no new component library or runtime dependency was introduced.

Proved in the real app: light desktop task maintenance, mobile stacked fields,
owner-scoped dark task queues, archive/restore, stale ownership rejection and
invalid-storage import recovery. Desktop uses 1280×720; mobile uses the Pixel 5
profile. Screenshots accompany the executable flows, not a separate mockup.

## Compatibility and limits

- Old recorded scores and contact dates are retained. New unknowns are `null`;
  no bulk rescore or engagement inference is performed.
- Old update proposals without conflict baselines must be rejected and prepared
  again. Stored dependencies are permitted and must be approved in order.
- Stricter imports can reject malformed nested fields that previously loaded.
  The original file is preserved; correct the reported field or use a backup.
- Browser storage remains single-writer. Folder locks coordinate cooperating
  processes on one host, not network drives, arbitrary editor writes, synced
  clones or distributed teams. Owner names are not authentication.
- The review gate is a product workflow, not a sandbox against an agent with
  direct filesystem access. Native schedules remain opt-in and need live setup
  verification in the user's harness.
- The package smoke proves the installed CLI, MCP, UI assets and API on the test
  host. Windows/macOS/Linux scheduler availability is checked during setup, not
  claimed by these tests.
