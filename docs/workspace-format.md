# Workspace Format

A workspace is a folder. `workspace.json` is the source of truth; everything
else in the folder is either generated from it or written for the agent.

## Records

`workspace.json` is one JSON object (see [`src/types.ts`](../src/types.ts)):

| Field | Holds |
| --- | --- |
| `name`, `edition`, `updatedAt` | Workspace identity. |
| `agentMode` | `"review"` (default) or `"direct"`. |
| `accounts[]` | Account with `contacts[]`, `needs[]`, `risks[]`, `tags[]`, stage, priority, owner, scores. |
| `deals[]` | Deal with `accountId`, stage, value, probability, close date. |
| `tasks[]` | Task with due date, priority, owner, optional `accountId`, `reason`, `evidence[]` (note ids), `origin`. |
| `notes[]` | Source note with `source`, `sourceRef`, sentiment, optional `contactId`, `origin`. |
| `claims[]` | What we know: `kind` (need, risk, goal, objection, commitment, fact), `text`, `evidence[]` (note ids), optional `contactId`, `status` (active, resolved, superseded), `resolvedReason`, `supersededBy`; commitments carry `owner` (us/them) and `due`. |
| `proposals[]` | Agent changes: the stored operation, a summary, status, who resolved it. |
| `activity[]` | The last 200 agent actions and decisions. |
| `receipts` | Stable-key retry receipts, retained when resolved proposal history is trimmed. |
| `ideas[]`, `changelog[]` | The Improve Open CRM corner. Not CRM data. |

`needs` and `risks` on an account are derived from its active claims of those
kinds and kept for older readers. A workspace written before claims existed
gets one claim per string on first read, with no evidence, so it shows as a
hunch until someone cites a note.

`origin` is set only on records an agent created: `{ "kind": "agent", "name": "claude-code" }`.

Ids are stable and prefixed by kind: `acct_`, `contact_`, `deal_`, `task_`,
`note_`, `prop_`, `act_`.

## Operations

Every write, from the app, the command, or MCP, is one of these operations
([`src/core/ops.ts`](../src/core/ops.ts)). Each is validated against the
current records before anything is stored.

| Operation | Command | MCP tool |
| --- | --- | --- |
| `account.add` | `crm account add --name …` | `crm_add_account` |
| `account.update` | `crm account update <account> --stage … --risk … --risk …` | `crm_update_account` |
| `account.archive` | `crm account archive <account> --reason …` / `restore` | `crm_archive_account` |
| `contact.add` | `crm contact add --account … --name … --role …` | `crm_add_contact` |
| `deal.add` | `crm deal add --account … --name … --value …` | `crm_add_deal` |
| `deal.move` | `crm deal move <deal id> <stage>` | `crm_move_deal` |
| `task.add` | `crm task add --title … --evidence <note id>,…` | `crm_add_task` |
| `task.set_status` | `crm task done <task id>` / `crm task reopen <task id>` | `crm_set_task_status` |
| `task.update` | `crm task update <id> …` / `wait` / `cancel` | `crm_update_task` |
| `note.add` | `crm note add --account … --source … --ref … --title … --body …` | `crm_add_note` |
| `claim.add` | `crm claim add --account … --kind … --text … --evidence <note id>` | `crm_add_claim` |
| `claim.resolve` | `crm claim resolve <claim id> --reason … [--now "…" --evidence …]` | `crm_resolve_claim` |

Read tools: `crm status`, `accounts`, `show`, `search`, `tasks`, `proposals`,
`log`, and their MCP equivalents `crm_status`, `crm_list_accounts`,
`crm_show_account`, `crm_search`, `crm_list_tasks`, `crm_list_proposals`.

Memory tools, computed from the records ([`src/core/memory.ts`](../src/core/memory.ts)):

| Command | MCP tool | Answers |
| --- | --- | --- |
| `crm brief <account>` | `crm_brief` | What changed since the last verified contact, what we know by kind with evidence and age, commitments, who decides and which roles are missing, what to ask. |
| `crm claims [--account] [--all]` | `crm_list_claims` | Each claim with grounding, contact, age, and whether it is stale or overdue. |
| `crm why <id>` | `crm_why` | A task, claim, or note: the sources upstream and what rests on it downstream. |
| `crm lint [--account]` | `crm_lint` | Hunches, evidence older than 45 days, overdue commitments, accounts with no one who signs off, contacts never seen, notes without a reference. |

A change is an operation plus the id of the record it creates, a timestamp, and
the actor. Applying a change is deterministic, which is what lets a proposal be
stored today and approved tomorrow without drift.

Update proposals retain a baseline of the fields they change. Approval refuses
to overwrite newer edits to those fields. Older update proposals without a
baseline must be rejected and prepared again. Unrelated edits do not block them.
Dependent proposals must be approved in order.

Routine writes use `--key <stable-key> --review`. Repeating the same key and
operation returns its existing result; a different operation or rejected result
is a conflict. Receipts are local history, not a queue to clear between runs.

## Evidence and work states

New account health, fit and source confidence are `null` (unknown), not zero.
Existing recorded scores are retained; this release does not invent a rescore.
`lastTouch` is unknown until verified contact exists. Notes keep capture time in
`createdAt` and optional actual source time in `occurredAt`. Only an explicit
`interaction: true` with a dated call, email, meeting or support interaction can
advance contact freshness. Research and contact creation cannot do so.
New people's `lastSeen` dates also start unknown; only a verified, dated
interaction linked to that person advances the date.

Tasks can be `open`, `waiting`, `done` or `cancelled`. Waiting and cancelled work
require a reason. A waiting task's due date is a review trigger, not an instruction
to send. Cancellation is not completion. Task edits retain original evidence.
Archived accounts retain all history but leave active task/deal queues; restoring
an account returns its unfinished work. Archive and restore require a reason.

Add `--json` to any command for structured output. Errors exit with status 2
(3 when the command needs a person's decision) and, with `--json`, print
`{"error": {"code", "message"}}` on stderr.

## Generated Views

`INDEX.md` and `accounts/<slug>.md` are rewritten on every change. They carry a
"generated" notice, YAML frontmatter with the account id, ISO dates so they diff
cleanly, and every record id in backticks. `crm check` fails when a view does
not match the records; `crm check --fix` regenerates them. Generated files
whose account no longer exists are removed. Files you wrote yourself are never
touched.

## Editing By Hand

You can edit `workspace.json` in an editor. The app and the command validate it
on every read: structure, allowed values, unique ids, and references between
records. A file that fails is refused with the list of problems, and nothing is
overwritten until it is fixed.

## The Local Server

`crm ui` serves the built app and a small JSON API on `127.0.0.1` only. The API
refuses requests whose `Host` is not loopback (DNS rebinding), whose `Origin` is
another site, or whose body is not JSON (cross-site form posts). Changes that
arrive from the page are always recorded as the person's, whatever the request
claims. Writers take a short file lock and replace `workspace.json` atomically.
The app hears about outside changes over server-sent events.

Imports and resets require the revision from the caller's latest read. Before
replacement, exact previous bytes are kept at `.open-crm/backups/<revision>.json`.
`crm restore <revision>` restores one explicit backup and also backs up the current
valid workspace. A corrupt current file needs manual recovery from a separately
preserved original; restore does not silently bypass validation. Backups contain
private data and need the same access controls as the workspace.

The lock coordinates processes on one host. It is not distributed locking for
network drives or synced clones, nor protection against arbitrary editor writes.
A live owner's lock is never stolen because of age. If ownership is unknown,
stop all CRM writers before manually repairing the lock.

Browser-only storage reports failed saves and preserves invalid originals.
Explicit import/reset makes a recovery backup before replacement. Export unsaved
work before leaving a failed-save session. Browser storage remains single-writer;
use folder mode for coordinated people-and-agent work.
