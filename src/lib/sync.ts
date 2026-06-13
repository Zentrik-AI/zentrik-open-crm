import type { Account, Deal, Note, Task, Workspace } from "../types";
import { formatDate, formatDateFull } from "./utils";
import { dealStageMeta, sourceMeta } from "./meta";

/**
 * Markdown-vault sync. Renders one Obsidian-style `.md` per account (plus an
 * index) and writes them into a folder the user picks via the File System
 * Access API — so the CRM works alongside the rest of your notes. Falls back to
 * a single combined-file download where the API is unavailable.
 */

const SYNC_STORAGE_KEY = "zentrik-open-crm.sync.v1";

export interface SyncSettings {
  vaultName?: string;
  lastSyncedAt?: string;
  fileCount?: number;
}

export function loadSyncSettings(): SyncSettings {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SYNC_STORAGE_KEY) ?? "{}") as SyncSettings;
  } catch {
    return {};
  }
}

export function saveSyncSettings(settings: SyncSettings) {
  try {
    window.localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export const supportsDirectoryPicker = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

function slug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account";
}

type VaultFile = { path: string; content: string };

// Quote scalar YAML values so names with `:`, leading `#`, or brackets stay valid.
const yq = (v: string) => JSON.stringify(v);

function accountMarkdown(account: Account, deals: Deal[], tasks: Task[], notes: Note[]): string {
  const fm = [
    "---",
    `title: ${yq(account.name)}`,
    "type: crm-account",
    `stage: ${yq(account.stage)}`,
    `priority: ${yq(account.priority)}`,
    `owner: ${yq(account.owner)}`,
    `arr: ${account.arr}`,
    `health: ${account.health}`,
    `fit: ${account.fit}`,
    `tags: [${["crm", ...account.tags].map((t) => JSON.stringify(t)).join(", ")}]`,
    `updated: ${yq(account.lastTouch)}`,
    "---",
  ].join("\n");

  const lines: string[] = [fm, "", `# ${account.name}`, "", `*${account.segment} · ${account.domain}*`, ""];

  lines.push("## Needs", ...account.needs.map((n) => `- ${n}`), "");
  lines.push("## Risks", ...account.risks.map((r) => `- ${r}`), "");

  if (account.contacts.length) {
    lines.push("## Contacts");
    for (const c of account.contacts) {
      lines.push(`- **${c.name}** — ${c.role} (${c.influence})${c.email ? ` · ${c.email}` : ""}`);
    }
    lines.push("");
  }

  if (deals.length) {
    lines.push("## Deals");
    for (const d of deals) {
      lines.push(
        `- **${d.name}** — ${dealStageMeta[d.stage].label}, $${d.value.toLocaleString()} · ${d.probability}% · close ${formatDate(d.closeDate)}`,
      );
    }
    lines.push("");
  }

  const openTasks = tasks.filter((t) => t.status === "open");
  if (openTasks.length) {
    lines.push("## Open tasks");
    for (const t of openTasks) lines.push(`- [ ] ${t.title} (due ${formatDate(t.due)}, ${t.priority})`);
    lines.push("");
  }

  if (notes.length) {
    lines.push("## Notes");
    for (const n of notes) {
      lines.push(
        `### ${n.title}`,
        `*${sourceMeta[n.source].label} · ${formatDateFull(n.createdAt)} · ${n.sentiment}*`,
        "",
        n.body,
        "",
      );
    }
  }

  return lines.join("\n");
}

/** Collision-proof slug per account, keyed by the unique account id. */
function uniqueSlugs(accounts: Account[]): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (const a of accounts) {
    const base = slug(a.name);
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) candidate = `${base}-${i++}`;
    used.add(candidate);
    map.set(a.id, candidate);
  }
  return map;
}

function indexMarkdown(workspace: Workspace, slugs: Map<string, string>): string {
  const lines = [
    "---",
    `title: ${yq(workspace.name)}`,
    "type: crm-index",
    `updated: ${yq(workspace.updatedAt)}`,
    "---",
    "",
    `# ${workspace.name}`,
    "",
    "| Account | Stage | Owner | Health |",
    "| --- | --- | --- | --- |",
  ];
  for (const a of workspace.accounts) {
    lines.push(`| [[${slugs.get(a.id)}\\|${a.name}]] | ${a.stage} | ${a.owner} | ${a.health} |`);
  }
  return lines.join("\n");
}

export function buildVaultFiles(workspace: Workspace): VaultFile[] {
  const slugs = uniqueSlugs(workspace.accounts);
  const files: VaultFile[] = [{ path: "_index.md", content: indexMarkdown(workspace, slugs) }];
  for (const account of workspace.accounts) {
    const deals = workspace.deals.filter((d) => d.accountId === account.id);
    const tasks = workspace.tasks.filter((t) => t.accountId === account.id);
    const notes = workspace.notes
      .filter((n) => n.accountId === account.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    files.push({ path: `${slugs.get(account.id)}.md`, content: accountMarkdown(account, deals, tasks, notes) });
  }
  return files;
}

/** A single account rendered as Markdown — for "copy as Markdown". */
export function accountToMarkdown(
  account: Account,
  deals: Deal[],
  tasks: Task[],
  notes: Note[],
): string {
  return accountMarkdown(account, deals, tasks, notes);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type DirHandle = {
  name: string;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<{
    createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
  }>;
};

export async function pickVault(): Promise<DirHandle> {
  return (window as any).showDirectoryPicker({ mode: "readwrite", id: "open-crm-vault" });
}

export async function writeVault(handle: DirHandle, files: VaultFile[]): Promise<number> {
  let count = 0;
  for (const file of files) {
    const fileHandle = await handle.getFileHandle(file.path, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file.content);
    await writable.close();
    count += 1;
  }
  return count;
}

/** Fallback: download one combined Markdown file. */
export function downloadCombinedMarkdown(workspace: Workspace) {
  const files = buildVaultFiles(workspace);
  const combined = files.map((f) => `<!-- ${f.path} -->\n\n${f.content}`).join("\n\n---\n\n");
  const blob = new Blob([combined], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "open-crm-vault.md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return files.length;
}
