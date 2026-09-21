# Portable agent setup

Open CRM installs an operating kit inside each initialized workspace. Open that
folder in the agent and ask it to complete `docs/agent-setup.md` before the first
standup. This is separate from developing the Open CRM source repository.

The source of the generated kit is [cli/agent-kit.ts](../cli/agent-kit.ts).
`agentKitFiles()` returns relative paths and text; it performs no writes and
creates no live schedules. Init owns installation and preservation of user edits.

The kit contains identical `open-crm-operator/SKILL.md` files in `.agents/skills`
and `.claude/skills`, setup and routine documents, and
`automations/routines.json`. `AGENTS.md` routes first use to setup; `CLAUDE.md`
imports that contract. Skill discovery is optional: agents can read the same
documents directly. No global skill installation is required.

## Setup acceptance

- Confirm workspace and host, owner scope, IANA timezone, cadence and result
  destination. Leave unknown fields unset and schedules disabled.
- Verify current CLI flags and run one manual review before scheduling.
- Detect native scheduling from the installed harness. Verify folder access,
  persistence and offline/expiry limits; do not assume CLI and desktop parity.
- For operational updates, select the exact shared local CRM folder on the
  coordinated writer host, not a disposable Git worktree. Claude Desktop local
  tasks can access that folder while the app is open and the machine awake.
  Cloud `/schedule` uses a fresh clone and cannot access local CRM records;
  do not upload private records or substitute cloud execution to work around it.
- Each manifest routine supplies a `promptTemplate`. Substitute only confirmed
  workspace, host, owner, timezone and output settings. Unresolved placeholders
  block enabling; no owner or timezone is preset.
- Inspect existing jobs by saved native ID and by workspace/host/routine/owner.
  Update a matching job rather than duplicate it. Uncertain creation requires
  reconciliation, not a blind retry.
- Enable only after user confirmation and native readback of the actual ID,
  prompt, scope, cadence, timezone, state and next run. Save the receipt locally.
- If unavailable, use manual daily/weekly prompts. The manifest is not an
  executable scheduler, and changing it cannot stop an existing native job.

No scheduler runs during init or refresh. No OS cron, background daemon,
provider credentials or external messaging is bundled. User-edited kit files
and configured receipts must survive upgrades.

## First manual run

In the initialized workspace, run `./crm setup --json` to inspect configuration.
This command reports local state; it does not complete setup, verify a native
schedule, or enable one. Follow the workspace's `docs/agent-setup.md`, confirm
the owner and workspace scope, and run the shared checks in
`docs/agent-routines.md`. Keep `deliveryMode` set to `manual` and routine entries
disabled when no scheduler is in use.

For source-backed changes, use `--key <stable-key> --review` on each note or
task. Record a known source date with `note add --occurred-at`; use
`--interaction` only for verified contact. A task can cite the note's returned
`recordId` in `--evidence` while both changes await review. Report their proposal
IDs without calling the records applied. On a repeat run, inspect canonical
records and all proposals first. Retrying the same key and payload must return
the existing work, not create another note or task.

## Upgrade and recovery

From the updated Open CRM source checkout, run:

```bash
npm run crm -- init /absolute/path/to/your-workspace --refresh
```

For an installed package, use that installation's `open-crm init
/absolute/path/to/your-workspace --refresh`. Use the new installation's command
if the old workspace wrapper points to a removed package or checkout.

Refresh rewrites `crm` and `crm.cmd`, installs missing kit files, and regenerates
Markdown record views. It preserves `workspace.json`, existing instructions,
MCP configuration and `automations/routines.json`. If bundled instructions
differ from an existing file, the new copy goes under `.open-crm/kit-updates/`
for manual comparison and merge. No replacement automation receipt is staged.
Run `./crm setup --json` and `./crm check --json` after refresh. A saved native
ID is not proof that a schedule is active; inspect it in its scheduler if used.

An installed package includes the built UI and a compiled JavaScript CLI; it
needs production dependencies only. Node does not strip TypeScript inside
`node_modules`, so the npm command uses `dist/runtime/bin/open-crm.js`. The
source checkout can still run `bin/open-crm.js` directly. If `./crm ui` reports a
missing bundle, reinstall the package, then refresh the wrapper if its path
changed. In a source checkout, install development dependencies with `npm install`
and run `npm run build` to repair a failed build.

Release validation uses `npm run test:package`: it builds and packs the current
checkout, installs the tarball with `--omit=dev --ignore-scripts`, and checks
manual onboarding, repeat-run deduplication, refresh preservation, MCP, and
the bundled UI/API. All records and receipts are synthetic temporary fixtures;
the check creates no live schedules and publishes nothing.

## Sources

Harness references checked 2026-09-20; setup must inspect current capabilities:

- [Codex skills](https://developers.openai.com/codex/skills)
- [Codex scheduled tasks](https://developers.openai.com/codex/app/automations)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude Desktop scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks)

For workspace operation, see [Agent Operator Guide](agent-operator-guide.md),
[Workspace Format](workspace-format.md), and [Agent routines](agent-routines.md).
