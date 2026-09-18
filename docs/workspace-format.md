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
| `proposals[]` | Agent changes: the stored operation, a summary, status, who resolved it. |
| `activity[]` | The last 200 agent actions and decisions. |
| `ideas[]`, `changelog[]` | The Improve Open CRM corner. Not CRM data. |

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
| `contact.add` | `crm contact add --account … --name … --role …` | `crm_add_contact` |
| `deal.add` | `crm deal add --account … --name … --value …` | `crm_add_deal` |
| `deal.move` | `crm deal move <deal id> <stage>` | `crm_move_deal` |
| `task.add` | `crm task add --title … --evidence <note id>,…` | `crm_add_task` |
| `task.set_status` | `crm task done <task id>` / `crm task reopen <task id>` | `crm_set_task_status` |
| `note.add` | `crm note add --account … --source … --ref … --title … --body …` | `crm_add_note` |

Read tools: `crm status`, `accounts`, `show`, `search`, `tasks`, `proposals`,
`log`, and their MCP equivalents `crm_status`, `crm_list_accounts`,
`crm_show_account`, `crm_search`, `crm_list_tasks`, `crm_list_proposals`.

A change is an operation plus the id of the record it creates, a timestamp, and
the actor. Applying a change is deterministic, which is what lets a proposal be
stored today and approved tomorrow without drift.

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
