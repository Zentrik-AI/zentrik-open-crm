import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, type ParseArgsConfig } from "node:util";
import type { AccountPatch, AccountStage, Actor, ClaimKind, Contact, DealStage, NoteSource, Priority, Sentiment, TaskPatch, Workspace } from "../src/types.ts";
import { createDemoWorkspace } from "../src/core/demo.ts";
import { OpError } from "../src/core/ops.ts";
import { normalizeWorkspace, parseWorkspace } from "../src/core/validate.ts";
import * as actions from "./actions.ts";
import { StoreError, WORKSPACE_FILE, readWorkspace, resolveWorkspaceDir, writeWorkspace, replaceWorkspace, restoreWorkspace, repairViews } from "./store.ts";
import { agentKitFiles } from "./agent-kit.ts";
import { agentsMd, claudeMd, cmdWrapper, gitignore, inboxReadme, mcpConfig, playbooks, shWrapper } from "./templates.ts";

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "open-crm.js");

const HELP = `Open CRM · a local-first CRM that people and agents work together

Usage: crm <command> [options]        (add --json to any command)

Set up
  init <folder> [--name "<name>"] [--demo]   create a workspace folder
  init <folder> --refresh                    refresh wrappers; stage guide updates without replacing edits
  ui [--port 5178] [--no-open]               open the visual CRM on this workspace
  mcp                                        run the MCP server over stdio
  setup                                      inspect setup and routine configuration (does not schedule)

Read
  status                                     what needs attention, and why
  accounts                                   every account with its id
  show <account>                             one account in full
  search "<text>"                            accounts, contacts, deals, tasks, notes
  tasks [--account <account>] [--all]        open tasks, soonest first
  proposals [--all]                          changes waiting for review
  log [--limit 20]                           what agents did, and what was decided

Know
  brief <account>                            the brief before a conversation: what changed, what we know, who decides, what to ask
  claims [--account <account>] [--all]       what we know, with evidence or marked as a hunch
  why <task | claim | note id>               where a record came from, and what rests on it
  lint [--account <account>]                 where the memory is thin: hunches, stale evidence, missing roles, overdue commitments

Write
  note add --account <account> --title "<t>" --body "<text or - for stdin>"
           [--source call|email|meeting|note|support|review|community|github|usage|market]
           [--ref "<source reference>"] [--sentiment positive|mixed|negative|neutral] [--contact <contact id>]
  task add --title "<t>" [--account <account>] [--due 2026-10-02] [--priority low|medium|high|urgent]
           [--owner "<name>"] [--reason "<why>"] [--evidence <note id>,<note id>]
  task done <task id>        task reopen <task id>
  task update <id> [--title "..."] [--due DATE] [--owner "..."] [--priority ...] [--status ...] [--reason "..."]
  task wait <id> --due DATE --reason "review trigger"     waiting is not due outreach
  task cancel <id> --reason "why"
  account archive <account> --reason "why"    restore uses the same syntax
  deal add --account <account> --name "<n>" [--value 48000] [--stage lead|qualified|proposal|negotiation] [--close 2026-11-15]
  deal move <deal id> <lead|qualified|proposal|negotiation|won|lost>
  account add --name "<n>" [--domain d] [--segment "<s>"] [--owner "<o>"] [--stage <stage>] [--priority <p>]
  account update <account> [--stage researching|active|expanding|renewing|at_risk] [--priority <p>] [--owner "<o>"]
           [--segment "<s>"] [--arr 42000] [--health 0-100] [--fit 0-100]
           [--need "<n>"]... [--risk "<r>"]... [--tag "<t>"]...     (repeat a flag to set the whole list)
  contact add --account <account> --name "<n>" --role "<r>" [--influence economic|champion|technical|user] [--email e]
  claim add --account <account> --kind need|risk|goal|objection|commitment|fact --text "<one idea>"
           [--evidence <note id>,<note id>] [--contact <contact id>] [--owner us|them --due 2026-10-02]   (commitments)
  claim resolve <claim id> --reason "<why>" [--now "<what is true instead>" [--evidence ...] [--kind ...]]

Decide (a person's call)
  approve <proposal id | all>                apply a proposed change
  reject <proposal id | all>                 discard it
  mode [review | direct]                     hold agent changes for review, or apply them at once

Maintain
  check [--fix]                              validate records; --fix regenerates stale Markdown views
  export [file]                              write a backup of workspace.json
  import <backup.json>                       replace this workspace with a backup (a person's call)
  restore <backup revision>                  restore a local replacement backup (a person's call)

Options
  -w, --workspace <folder>   workspace to use (default: nearest workspace.json above the current folder)
  --as <name>                name recorded on changes (default: detected from your harness)
  --json                     structured output
  --key <stable-key>          deduplicate retries across runs; reuse identical payload
  --review                   require proposal review even in direct mode
  note add: --occurred-at DATE is the source date; --interaction marks verified contact
`;

type Flags = Record<string, string | boolean | string[] | undefined>;

const common = {
  workspace: { type: "string", short: "w" },
  json: { type: "boolean" },
  as: { type: "string" },
  key: { type: "string" },
  review: { type: "boolean" },
  help: { type: "boolean", short: "h" },
} as const;

function parse(argv: string[], options: NonNullable<ParseArgsConfig["options"]> = {}) {
  try {
    const { values, positionals } = parseArgs({ args: argv, options: { ...common, ...options }, allowPositionals: true, strict: true });
    return { flags: values as Flags, rest: positionals };
  } catch (error) {
    throw new OpError("bad_usage", `${(error as Error).message.split(/\. To specify|\n/)[0].replace(/\.$/, "")}. See: crm help`);
  }
}

const text = (flags: Flags, key: string) => (typeof flags[key] === "string" ? (flags[key] as string) : undefined);
const list = (flags: Flags, key: string) => (Array.isArray(flags[key]) ? (flags[key] as string[]) : undefined);

function numberFlag(flags: Flags, key: string): number | undefined {
  const raw = text(flags, key);
  if (raw === undefined) return undefined;
  const value = Number(raw.replace(/[$,_]/g, ""));
  if (!Number.isFinite(value)) throw new OpError("invalid_value", `--${key} must be a number.`);
  return value;
}

function required(flags: Flags, key: string): string {
  const value = text(flags, key);
  if (!value?.trim()) throw new OpError("missing_field", `--${key} is required.`);
  return value;
}

/** An agent's shell is not a terminal, and most harnesses announce themselves. */
function detectActor(flags: Flags): Actor {
  const named = text(flags, "as") ?? process.env.OPEN_CRM_ACTOR;
  if (named) return { kind: "agent", name: named };
  if (process.env.CLAUDECODE) return { kind: "agent", name: "claude-code" };
  if (process.env.CURSOR_AGENT || process.env.CURSOR_TRACE_ID) return { kind: "agent", name: "cursor" };
  if (Object.keys(process.env).some((key) => key.startsWith("CODEX_"))) return { kind: "agent", name: "codex" };
  if (process.stdin.isTTY && process.stdout.isTTY) return { kind: "human", name: process.env.USER || "you" };
  return { kind: "agent", name: "agent" };
}

/** Approvals and mode changes belong to a person. At a terminal that is
 *  whoever is typing; anywhere else the caller must say who decided. */
function decider(flags: Flags): string {
  const named = text(flags, "approved-by");
  if (named) return named;
  if (detectActor(flags).kind === "human") return process.env.USER || "you";
  throw new OpError(
    "needs_person",
    "This is a person's decision. Ask them to decide in the app under Review. If they told you to do it in this session, repeat the command with --approved-by \"<their name>\".",
  );
}

function readBody(value: string): string {
  return value === "-" ? fs.readFileSync(0, "utf8") : value;
}

function emit(flags: Flags, data: unknown, render: () => string) {
  process.stdout.write(flags.json ? `${JSON.stringify(data, null, 2)}\n` : `${render().trimEnd()}\n`);
}

const day = (iso: string | null) => iso?.slice(0, 10) ?? "unknown";
const writeOptions = (flags: Flags) => ({ key: text(flags, "key"), review: flags.review === true });
const money = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

function renderChange(result: actions.ChangeResult) {
  return result.outcome === "applied"
    ? `✓ ${result.summary}  (${result.id})`
    : `◇ Proposed: ${result.summary}  (${result.recordId})\n  ${result.next}`;
}

function writeIfMissing(file: string, content: string, overwrite: boolean, mode?: number) {
  if (!overwrite && fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, mode ? { mode } : undefined);
  if (mode) fs.chmodSync(file, mode);
  return true;
}

function scaffold(dir: string, workspace: Workspace, refresh: boolean) {
  const node = process.execPath;
  const managed = { "AGENTS.md": agentsMd(workspace), "CLAUDE.md": claudeMd,
    ...Object.fromEntries(Object.entries(playbooks).map(([name, content]) => [`playbooks/${name}`, content])), ...agentKitFiles() };
  for (const [name, content] of Object.entries(managed)) {
    const file = path.join(dir, name);
    if (writeIfMissing(file, content, false)) continue;
    if (refresh && fs.readFileSync(file, "utf8") !== content && name !== "automations/routines.json") {
      writeIfMissing(path.join(dir, ".open-crm", "kit-updates", name), content, true);
    }
  }
  writeIfMissing(path.join(dir, "inbox", "README.md"), inboxReadme, false);
  writeIfMissing(path.join(dir, "drafts", ".gitkeep"), "", false);
  writeIfMissing(path.join(dir, ".gitignore"), gitignore, false);
  writeIfMissing(path.join(dir, "crm"), shWrapper(node, BIN), true, 0o755);
  writeIfMissing(path.join(dir, "crm.cmd"), cmdWrapper(node, BIN), true);
  const mcpCommand = process.platform === "win32" ? node : "./crm";
  const mcpArgs = process.platform === "win32" ? [BIN, "--workspace", dir, "mcp"] : ["mcp"];
  writeIfMissing(path.join(dir, ".mcp.json"), mcpConfig(mcpCommand, mcpArgs), false);
  writeIfMissing(path.join(dir, ".cursor", "mcp.json"), mcpConfig(mcpCommand, mcpArgs), false);
}

function demoWorkspace(name?: string): Workspace {
  const demo = createDemoWorkspace();
  if (name) demo.name = name;
  return normalizeWorkspace(demo);
}

function init(argv: string[]) {
  const { flags, rest } = parse(argv, { name: { type: "string" }, demo: { type: "boolean" }, refresh: { type: "boolean" } });
  const dir = path.resolve(rest[0] ?? text(flags, "workspace") ?? ".");
  const file = path.join(dir, WORKSPACE_FILE);

  if (flags.refresh) {
    const { workspace } = readWorkspace(dir);
    scaffold(dir, workspace, true);
    repairViews(dir);
    return emit(flags, { dir, refreshed: true, updates: ".open-crm/kit-updates", preservesUserFiles: true }, () => `✓ Updated ./crm and installed missing agent files in ${dir}. Existing instructions and schedule receipts are preserved. Review any new bundled instructions in .open-crm/kit-updates.`);
  }
  if (fs.existsSync(file)) throw new OpError("exists", `${file} already exists. Use --refresh to update the agent files around it.`);

  const name = text(flags, "name");
  const workspace: Workspace = flags.demo
    ? demoWorkspace(name)
    : normalizeWorkspace({
        name: name ?? "My CRM workspace",
        edition: "Self-Hosted",
        updatedAt: new Date().toISOString(),
        accounts: [],
        deals: [],
        tasks: [],
        notes: [],
        ideas: [],
        changelog: [],
      });
  fs.mkdirSync(dir, { recursive: true });
  writeWorkspace(dir, workspace);
  scaffold(dir, workspace, false);

  const relative = path.relative(process.cwd(), dir) || ".";
  const rel = relative.startsWith("..") ? dir : relative;
  emit(flags, { dir, name: workspace.name, demo: Boolean(flags.demo) }, () =>
    [
      `✓ Created ${workspace.name} in ${dir}${flags.demo ? " with synthetic demo records" : ""}`,
      "",
      "Next:",
      `  cd ${rel}`,
      "  ./crm ui          open the visual CRM on this folder",
      "  claude            or codex, or open the folder in Cursor. The agent reads AGENTS.md and drives ./crm",
      "",
      'Try asking: "Run the daily review."',
    ].join("\n"),
  );
}

async function run(argv: string[]) {
  const [command, ...rest] = argv;
  const sub = rest[0];

  if (!command || command === "help" || command === "--help" || command === "-h") return process.stdout.write(HELP);
  if (command === "init") return init(rest);

  if (command === "mcp") {
    const { flags } = parse(rest);
    const { serveMcp } = await import("./mcp.ts");
    return serveMcp(resolveWorkspaceDir(text(flags, "workspace")));
  }

  if (command === "ui") {
    const { flags } = parse(rest, { port: { type: "string" }, "no-open": { type: "boolean" } });
    const { serveUi } = await import("./server.ts");
    return serveUi(resolveWorkspaceDir(text(flags, "workspace")), { port: numberFlag(flags, "port"), open: !flags["no-open"] });
  }

  if (command === "setup") {
    const { flags } = parse(rest);
    const dir = resolveWorkspaceDir(text(flags, "workspace"));
    const file = path.join(dir, "automations", "routines.json");
    const configuration = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    return emit(flags, { workspace: dir, configuration, instructions: "docs/agent-setup.md", liveScheduleVerified: false }, () => `Read docs/agent-setup.md in ${dir}. Confirm scope and run one manual review. Local configuration: ${configuration?.status ?? "missing: run init --refresh"}. A manifest is not a running scheduler; verify native IDs in the host before claiming active automation.`);
  }

  if (command === "status") {
    const { flags } = parse(rest);
    const brief = actions.status(resolveWorkspaceDir(text(flags, "workspace")));
    return emit(flags, brief, () => {
      const c = brief.counts;
      const lines = [
        `${brief.workspace} · ${day(brief.generatedAt)} · agent changes: ${brief.agentMode}`,
        `${c.accounts} accounts · ${c.openDeals} open deals (${money(brief.weightedPipeline)} weighted) · ${c.openTasks} open tasks · ${c.notes} notes`,
        c.pendingProposals ? `${c.pendingProposals} proposed change${c.pendingProposals === 1 ? "" : "s"} waiting for review (crm proposals)` : "",
        "",
        brief.attention.length ? "Needs attention:" : "Nothing needs attention right now.",
        ...brief.attention.map((item) => `  ${item.rank <= 2 ? "!" : "·"} ${item.why}  [${item.accountName ? `${item.accountName} · ` : ""}${item.recordId}]`),
      ];
      return lines.filter((line, i) => line !== "" || i === 3).join("\n");
    });
  }

  if (command === "brief") {
    const { flags, rest: pos } = parse(rest);
    if (!pos[0]) throw new OpError("missing_field", "Usage: crm brief <account>");
    const result = actions.brief(resolveWorkspaceDir(text(flags, "workspace")), pos.join(" "));
    return emit(flags, result.memory, () => result.markdown);
  }

  if (command === "claims") {
    const { flags } = parse(rest, { account: { type: "string" }, all: { type: "boolean" } });
    const rows = actions.listClaims(resolveWorkspaceDir(text(flags, "workspace")), { account: text(flags, "account"), all: Boolean(flags.all) });
    return emit(flags, rows, () => {
      if (!rows.length) return 'Nothing recorded yet. Record what a note says with: crm claim add --account <account> --kind need --text "…" --evidence <note id>';
      const byAccount = new Map<string, typeof rows>();
      for (const row of rows) byAccount.set(row.accountName ?? row.accountId, [...(byAccount.get(row.accountName ?? row.accountId) ?? []), row]);
      return [...byAccount.entries()]
        .map(([name, items]) => [name, ...items.map((c) => {
          const mark = c.status !== "active" ? "✕" : c.grounded ? "●" : "○";
          const how = c.status !== "active" ? `${c.status} · ${c.resolvedReason ?? ""}` : c.grounded ? `${c.evidence.length} ${c.evidence.length === 1 ? "note" : "notes"} · ${c.ageDays}d${c.stale ? " · stale" : ""}` : "hunch, no source";
          const due = c.kind === "commitment" ? ` · ${c.owner === "them" ? "theirs" : "ours"}${c.due ? ` by ${day(c.due)}` : ""}${c.overdue ? " · OVERDUE" : ""}` : "";
          return `  ${mark} ${c.kind.padEnd(10)} ${c.text}${c.contactName ? ` · ${c.contactName}` : ""}${due}  [${c.id}]\n               ${how}`;
        })].join("\n"))
        .join("\n\n");
    });
  }

  if (command === "why") {
    const { flags, rest: pos } = parse(rest);
    if (!pos[0]) throw new OpError("missing_field", "Usage: crm why <task | claim | note id>");
    const result = actions.why(resolveWorkspaceDir(text(flags, "workspace")), pos[0]);
    return emit(flags, result, () => {
      const line = (n: typeof result.focus) => `${n.kind.padEnd(7)} ${n.title}${n.detail ? ` (${n.detail}${n.date ? ` · ${day(n.date)}` : ""})` : ""}  [${n.id}]${n.tone === "hunch" ? "  · hunch" : ""}`;
      return [
        line(result.focus),
        ...(result.upstream.length ? ["", "Rests on:", ...result.upstream.map((n) => `  ← ${line(n)}`)] : ["", "Rests on nothing recorded: this is a hunch."]),
        ...(result.downstream.length ? ["", "Supports:", ...result.downstream.map((n) => `  → ${line(n)}`)] : []),
      ].join("\n");
    });
  }

  if (command === "lint") {
    const { flags } = parse(rest, { account: { type: "string" } });
    const findings = actions.lint(resolveWorkspaceDir(text(flags, "workspace")), text(flags, "account"));
    emit(flags, findings, () => {
      if (!findings.length) return "✓ Every active claim has a source, every deciding account has someone who signs off, and no commitment is overdue.";
      const byAccount = new Map<string, typeof findings>();
      for (const f of findings) byAccount.set(f.accountName ?? "Workspace", [...(byAccount.get(f.accountName ?? "Workspace") ?? []), f]);
      const warn = findings.filter((f) => f.severity === "warn").length;
      return [
        `${findings.length} ${findings.length === 1 ? "finding" : "findings"} · ${warn} worth acting on`,
        ...[...byAccount.entries()].flatMap(([name, items]) => ["", name, ...items.map((f) => `  ${f.severity === "warn" ? "!" : "·"} ${f.message}${f.recordId ? `  [${f.recordId}]` : ""}`)]),
      ].join("\n");
    });
    return;
  }

  if (command === "accounts") {
    const { flags } = parse(rest);
    const rows = actions.listAccounts(resolveWorkspaceDir(text(flags, "workspace")));
    return emit(flags, rows, () =>
      rows.length
        ? rows.map((a) => `${a.name}  [${a.id}]\n  ${a.stage} · ${a.priority} · ${a.owner} · health ${a.health} · ${a.openTasks} open tasks · ${a.notes} notes · last touch ${day(a.lastTouch)}`).join("\n")
        : 'No accounts yet. Add one with: crm account add --name "<name>"',
    );
  }

  if (command === "show") {
    const { flags, rest: pos } = parse(rest);
    if (!pos[0]) throw new OpError("missing_field", "Usage: crm show <account>");
    const result = actions.showAccount(resolveWorkspaceDir(text(flags, "workspace")), pos.join(" "));
    return emit(flags, { account: result.account, deals: result.deals, tasks: result.tasks, notes: result.notes, pending: result.pending }, () => result.markdown);
  }

  if (command === "search") {
    const { flags, rest: pos } = parse(rest);
    const hits = actions.search(resolveWorkspaceDir(text(flags, "workspace")), pos.join(" "));
    return emit(flags, hits, () =>
      hits.length
        ? hits.map((h) => `${h.kind.padEnd(7)} ${h.title}  [${h.id}]${h.accountName && h.kind !== "account" ? ` · ${h.accountName}` : ""}${h.snippet ? `\n        …${h.snippet}…` : ""}`).join("\n")
        : "No matches.",
    );
  }

  if (command === "tasks") {
    const { flags } = parse(rest, { account: { type: "string" }, all: { type: "boolean" } });
    const rows = actions.listTasks(resolveWorkspaceDir(text(flags, "workspace")), { all: Boolean(flags.all), account: text(flags, "account") });
    return emit(flags, rows, () =>
      rows.length
        ? rows.map((t) => `${t.status === "done" ? "[x]" : "[ ]"} ${t.title}  [${t.id}]\n    due ${day(t.due)} · ${t.priority} · ${t.owner}${t.accountName ? ` · ${t.accountName}` : ""}${t.evidence?.length ? ` · evidence ${t.evidence.join(", ")}` : ""}`).join("\n")
        : "No open tasks.",
    );
  }

  if (command === "proposals") {
    const { flags } = parse(rest, { all: { type: "boolean" } });
    const rows = actions.listProposals(resolveWorkspaceDir(text(flags, "workspace")), Boolean(flags.all));
    return emit(flags, rows, () =>
      rows.length ? rows.map((p) => `${p.status === "pending" ? "◇" : p.status === "applied" ? "✓" : "✕"} ${p.summary}  [${p.id}]\n    ${p.status} · by ${p.actor.name} · ${day(p.createdAt)}`).join("\n") : "Nothing is waiting for review.",
    );
  }

  if (command === "log") {
    const { flags } = parse(rest, { limit: { type: "string" } });
    const rows = actions.activity(resolveWorkspaceDir(text(flags, "workspace")), numberFlag(flags, "limit") ?? 20);
    return emit(flags, rows, () => (rows.length ? rows.map((e) => `${e.at.slice(0, 16).replace("T", " ")}  ${e.actor.name}  ${e.summary}`).join("\n") : "No agent activity recorded yet."));
  }

  if (command === "approve" || command === "reject") {
    const { flags, rest: pos } = parse(rest, { "approved-by": { type: "string" } });
    if (!pos[0]) throw new OpError("missing_field", `Usage: crm ${command} <proposal id | all>`);
    const resolved = actions.decide(resolveWorkspaceDir(text(flags, "workspace")), pos[0], command, decider(flags));
    return emit(flags, resolved, () => resolved.map((p) => `${p.status === "applied" ? "✓ Applied" : "✕ Rejected"}: ${p.summary}  [${p.id}]`).join("\n"));
  }

  if (command === "mode") {
    const { flags, rest: pos } = parse(rest, { "approved-by": { type: "string" } });
    const dir = resolveWorkspaceDir(text(flags, "workspace"));
    if (!pos[0]) {
      const mode = readWorkspace(dir).workspace.agentMode ?? "review";
      return emit(flags, { agentMode: mode }, () => `Agent changes: ${mode}`);
    }
    if (pos[0] !== "review" && pos[0] !== "direct") throw new OpError("invalid_value", "Mode must be review or direct.");
    decider(flags);
    const mode = actions.setAgentMode(dir, pos[0]);
    return emit(flags, { agentMode: mode }, () => `✓ Agent changes now ${mode === "review" ? "wait for review" : "apply directly and are logged"}.`);
  }

  if (command === "check") {
    const { flags } = parse(rest, { fix: { type: "boolean" } });
    const report = actions.check(resolveWorkspaceDir(text(flags, "workspace")), Boolean(flags.fix));
    emit(flags, report, () =>
      [
        report.ok ? "✓ Records are valid and the Markdown views match them." : "✕ The workspace needs attention.",
        ...report.errors.map((e) => `  error: ${e}`),
        ...report.staleViews.map((f) => `  stale view: ${f} (run: crm check --fix)`),
        ...report.warnings.map((w) => `  note: ${w}`),
      ].join("\n"),
    );
    if (!report.ok) process.exitCode = 1;
    return;
  }

  if (command === "export") {
    const { flags, rest: pos } = parse(rest);
    const dir = resolveWorkspaceDir(text(flags, "workspace"));
    const target = path.resolve(pos[0] ?? `open-crm-backup-${day(new Date().toISOString())}.json`);
    fs.writeFileSync(target, `${JSON.stringify(readWorkspace(dir).workspace, null, 2)}\n`);
    return emit(flags, { file: target }, () => `✓ Backup written to ${target}`);
  }

  if (command === "import") {
    const { flags, rest: pos } = parse(rest, { "approved-by": { type: "string" } });
    if (!pos[0]) throw new OpError("missing_field", "Usage: crm import <backup.json>");
    const dir = resolveWorkspaceDir(text(flags, "workspace"));
    decider(flags);
    const { workspace, errors } = parseWorkspace(fs.readFileSync(path.resolve(pos[0]), "utf8"));
    if (!workspace) throw new OpError("invalid_workspace", `That file is not a valid workspace:\n${errors.slice(0, 12).map((e) => `  - ${e}`).join("\n")}`);
    const baseRev = readWorkspace(dir).rev;
    const saved = replaceWorkspace(dir, workspace, baseRev);
    return emit(flags, { imported: workspace.name, backupPath: saved.backupPath }, () => `✓ Replaced this workspace with ${workspace.name} (${workspace.accounts.length} accounts). Previous records: ${saved.backupPath}`);
  }

  if (command === "restore") {
    const { flags, rest: pos } = parse(rest, { "approved-by": { type: "string" } });
    const dir = resolveWorkspaceDir(text(flags, "workspace"));
    decider(flags);
    if (!pos[0]) throw new OpError("missing_field", "Provide the revision from .open-crm/backups/<revision>.json.");
    const saved = restoreWorkspace(dir, pos[0], readWorkspace(dir).rev);
    return emit(flags, { restored: saved.rev, backupPath: saved.backupPath }, () => `✓ Restored revision ${saved.rev}. Previous records: ${saved.backupPath}`);
  }

  /* ---- writes: <noun> <verb> ---- */
  const args = rest.slice(1);

  if (command === "note" && sub === "add") {
    const { flags } = parse(args, { account: { type: "string" }, title: { type: "string" }, body: { type: "string" }, source: { type: "string" }, ref: { type: "string" }, sentiment: { type: "string" }, contact: { type: "string" }, "occurred-at": { type: "string" }, interaction: { type: "boolean" } });
    const dir = resolveWorkspaceDir(text(flags, "workspace"));
    const body = readBody(required(flags, "body"));
    const result = actions.change(dir, detectActor(flags), (workspace) => ({
      type: "note.add",
      accountId: actions.resolveAccount(workspace, required(flags, "account")).id,
      title: required(flags, "title"),
      body,
      source: (text(flags, "source") ?? "note") as NoteSource,
      sourceRef: text(flags, "ref"),
      sentiment: text(flags, "sentiment") as Sentiment | undefined,
      contactId: text(flags, "contact"),
      occurredAt: text(flags, "occurred-at"),
      interaction: flags.interaction === true,
    }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "task" && sub === "add") {
    const { flags } = parse(args, { account: { type: "string" }, title: { type: "string" }, due: { type: "string" }, priority: { type: "string" }, owner: { type: "string" }, reason: { type: "string" }, evidence: { type: "string" } });
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), (workspace) => ({
      type: "task.add",
      title: required(flags, "title"),
      accountId: text(flags, "account") ? actions.resolveAccount(workspace, text(flags, "account")!).id : undefined,
      due: text(flags, "due"),
      priority: text(flags, "priority") as Priority | undefined,
      owner: text(flags, "owner"),
      reason: text(flags, "reason"),
      evidence: text(flags, "evidence")?.split(",").map((id) => id.trim()).filter(Boolean),
    }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "task" && (sub === "done" || sub === "reopen")) {
    const { flags, rest: pos } = parse(args);
    if (!pos[0]) throw new OpError("missing_field", `Usage: crm task ${sub} <task id>`);
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), () => ({ type: "task.set_status", taskId: pos[0], status: sub === "done" ? "done" : "open" }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "task" && ["update", "wait", "cancel"].includes(sub)) {
    const { flags, rest: pos } = parse(args, { title: { type: "string" }, due: { type: "string" }, owner: { type: "string" }, priority: { type: "string" }, reason: { type: "string" }, status: { type: "string" } });
    if (!pos[0]) throw new OpError("missing_field", "A task id is required.");
    const patch: TaskPatch = {};
    for (const key of ["title", "due", "owner", "reason"] as const) if (text(flags, key) !== undefined) patch[key] = text(flags, key);
    if (text(flags, "priority")) patch.priority = text(flags, "priority") as Priority;
    if (text(flags, "status")) patch.status = text(flags, "status") as TaskPatch["status"];
    if (sub === "wait") { patch.status = "waiting"; patch.reason = required(flags, "reason"); patch.due = required(flags, "due"); }
    if (sub === "cancel") { patch.status = "cancelled"; patch.reason = required(flags, "reason"); }
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), () => ({ type: "task.update", taskId: pos[0], patch }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "account" && ["archive", "restore"].includes(sub)) {
    const { flags, rest: pos } = parse(args, { reason: { type: "string" } });
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), workspace => ({ type: "account.archive", accountId: actions.resolveAccount(workspace, pos.join(" ")).id, archived: sub === "archive", reason: required(flags, "reason") }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "deal" && sub === "add") {
    const { flags } = parse(args, { account: { type: "string" }, name: { type: "string" }, value: { type: "string" }, stage: { type: "string" }, close: { type: "string" }, owner: { type: "string" } });
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), (workspace) => ({
      type: "deal.add",
      accountId: actions.resolveAccount(workspace, required(flags, "account")).id,
      name: required(flags, "name"),
      value: numberFlag(flags, "value"),
      stage: text(flags, "stage") as DealStage | undefined,
      closeDate: text(flags, "close"),
      owner: text(flags, "owner"),
    }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "deal" && sub === "move") {
    const { flags, rest: pos } = parse(args);
    if (!pos[0] || !pos[1]) throw new OpError("missing_field", "Usage: crm deal move <deal id> <stage>");
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), () => ({ type: "deal.move", dealId: pos[0], stage: pos[1] as DealStage }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "account" && sub === "add") {
    const { flags } = parse(args, { name: { type: "string" }, domain: { type: "string" }, segment: { type: "string" }, owner: { type: "string" }, stage: { type: "string" }, priority: { type: "string" } });
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), () => ({
      type: "account.add",
      name: required(flags, "name"),
      domain: text(flags, "domain"),
      segment: text(flags, "segment"),
      owner: text(flags, "owner"),
      stage: text(flags, "stage") as AccountStage | undefined,
      priority: text(flags, "priority") as Priority | undefined,
    }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "account" && sub === "update") {
    const { flags, rest: pos } = parse(args, {
      name: { type: "string" }, domain: { type: "string" }, segment: { type: "string" }, owner: { type: "string" }, stage: { type: "string" }, priority: { type: "string" },
      arr: { type: "string" }, health: { type: "string" }, fit: { type: "string" },
      need: { type: "string", multiple: true }, risk: { type: "string", multiple: true }, tag: { type: "string", multiple: true },
    });
    if (!pos[0]) throw new OpError("missing_field", "Usage: crm account update <account> [--stage …]");
    const patch: AccountPatch = {};
    for (const key of ["name", "domain", "segment", "owner"] as const) if (text(flags, key) !== undefined) patch[key] = text(flags, key)!;
    if (text(flags, "stage")) patch.stage = text(flags, "stage") as AccountStage;
    if (text(flags, "priority")) patch.priority = text(flags, "priority") as Priority;
    for (const key of ["arr", "health", "fit"] as const) if (numberFlag(flags, key) !== undefined) patch[key] = numberFlag(flags, key)!;
    if (list(flags, "need")) patch.needs = list(flags, "need");
    if (list(flags, "risk")) patch.risks = list(flags, "risk");
    if (list(flags, "tag")) patch.tags = list(flags, "tag");
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), (workspace) => ({ type: "account.update", accountId: actions.resolveAccount(workspace, pos.join(" ")).id, patch }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "claim" && sub === "add") {
    const { flags } = parse(args, { account: { type: "string" }, kind: { type: "string" }, text: { type: "string" }, evidence: { type: "string" }, contact: { type: "string" }, owner: { type: "string" }, due: { type: "string" } });
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), (workspace) => ({
      type: "claim.add",
      accountId: actions.resolveAccount(workspace, required(flags, "account")).id,
      kind: required(flags, "kind") as ClaimKind,
      text: required(flags, "text"),
      evidence: text(flags, "evidence")?.split(",").map((id) => id.trim()).filter(Boolean),
      contactId: text(flags, "contact"),
      owner: text(flags, "owner") as "us" | "them" | undefined,
      due: text(flags, "due"),
    }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "claim" && sub === "resolve") {
    const { flags, rest: pos } = parse(args, { reason: { type: "string" }, now: { type: "string" }, evidence: { type: "string" }, kind: { type: "string" }, owner: { type: "string" }, due: { type: "string" } });
    if (!pos[0]) throw new OpError("missing_field", "Usage: crm claim resolve <claim id> --reason \"<why>\" [--now \"<what is true instead>\"]");
    const now = text(flags, "now");
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), () => ({
      type: "claim.resolve",
      claimId: pos[0],
      reason: required(flags, "reason"),
      replacement: now ? { text: now, evidence: text(flags, "evidence")?.split(",").map((id) => id.trim()).filter(Boolean), kind: text(flags, "kind") as ClaimKind | undefined, owner: text(flags, "owner") as "us" | "them" | undefined, due: text(flags, "due") } : undefined,
    }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  if (command === "contact" && sub === "add") {
    const { flags } = parse(args, { account: { type: "string" }, name: { type: "string" }, role: { type: "string" }, influence: { type: "string" }, email: { type: "string" } });
    const result = actions.change(resolveWorkspaceDir(text(flags, "workspace")), detectActor(flags), (workspace) => ({
      type: "contact.add",
      accountId: actions.resolveAccount(workspace, required(flags, "account")).id,
      name: required(flags, "name"),
      role: required(flags, "role"),
      influence: text(flags, "influence") as Contact["influence"] | undefined,
      email: text(flags, "email"),
    }), writeOptions(flags));
    return emit(flags, result, () => renderChange(result));
  }

  throw new OpError("bad_usage", `Unknown command "${[command, sub].filter(Boolean).join(" ")}". See: crm help`);
}

export async function main(argv: string[]) {
  // Global options may come before the command (the ./crm wrapper puts
  // --workspace there); move them behind it so each command parses them.
  const lead: string[] = [];
  while (argv[0]?.startsWith("-") && !["-h", "--help"].includes(argv[0])) {
    lead.push(...argv.splice(0, ["--workspace", "-w", "--as", "--key"].includes(argv[0]) ? 2 : 1));
  }
  const [command, ...rest] = argv;
  try {
    await run(command ? [command, ...rest, ...lead] : []);
  } catch (error) {
    if (error instanceof OpError || error instanceof StoreError) {
      const wantsJson = argv.includes("--json");
      process.stderr.write(wantsJson ? `${JSON.stringify({ error: { code: error.code, message: error.message } })}\n` : `crm: ${error.message}\n`);
      process.exitCode = error instanceof OpError && error.code === "needs_person" ? 3 : 2;
      return;
    }
    throw error;
  }
}
