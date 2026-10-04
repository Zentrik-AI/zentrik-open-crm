import { useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  FolderOpen,
  FolderSync,
  KeyRound,
  Milestone,
  RefreshCcw,
} from "lucide-react";
import { aiModels, maskKey, type AiModel, type AiSettings } from "../lib/ai";
import { supportsDirectoryPicker, type SyncSettings } from "../lib/sync";
import { formatRelative } from "../lib/utils";
import { Well } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { Badge } from "../components/ui/badge";
import { ZentrikMark } from "../components/zentrik-mark";

export type AiTest = { state: "idle" | "testing" | "ok" | "error"; message?: string };

const redactedFields = [
  "Revenue, deal values and pipeline",
  "Account domains",
  "Contact names and emails",
  "Risk notes and note bodies",
  "Agent and account-data copy actions",
];

/** One settings section: title and one line on the left, controls on the right. */
function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-t border-border py-8 first:border-t-0 first:pt-2 last:pb-2 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="min-w-0">
        <h2 className="text-h3 text-foreground">{title}</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

/** Secondary explanation, closed by default. */
function HowItWorks({ label = "How this works", children }: { label?: string; children: ReactNode }) {
  return (
    <details className="group text-body-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 transition-transform duration-fast group-open:rotate-90" aria-hidden />
        {label}
      </summary>
      <div className="mt-3 space-y-3 pl-[18px] text-muted-foreground">{children}</div>
    </details>
  );
}

/** A path or command in a compact monospace chip with a copy button. */
function CopyChip({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex h-9 min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-surface-sunken pl-3 pr-1">
      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-faint-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-mono text-label text-foreground" title={value}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={label}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:focus-ring"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

const folderCommands: Array<[string, string]> = [
  ["./crm status", "What needs attention, and why"],
  ["./crm help", "Every command"],
  ["claude  ·  codex", "Start an agent in this folder"],
];

export function SettingsView({
  aiSettings,
  onSaveAi,
  aiTest,
  onTestAi,
  sync,
  syncBusy,
  onConnectVault,
  onSyncNow,
  onDownloadMarkdown,
  agentPrompt,
  onCopyAgentPrompt,
  onExport,
  onImport,
  onReset,
  onOpenOnboarding,
  folder,
  onOpenReview,
}: {
  aiSettings: AiSettings;
  onSaveAi: (apiKey: string, model: AiModel) => void;
  aiTest: AiTest;
  onTestAi: () => void;
  sync: SyncSettings;
  syncBusy: boolean;
  onConnectVault: () => void;
  onSyncNow: () => void;
  onDownloadMarkdown: () => void;
  agentPrompt: string;
  onCopyAgentPrompt: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  onOpenOnboarding: () => void;
  /** Set when the app runs on a workspace folder shared with agents. */
  folder: { dir?: string } | null;
  onOpenReview: () => void;
}) {
  const [keyInput, setKeyInput] = useState(aiSettings.apiKey);
  const [model, setModel] = useState<AiModel>(aiSettings.model);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canPick = supportsDirectoryPicker();
  const dirty = keyInput.trim() !== aiSettings.apiKey || model !== aiSettings.model;

  function save() {
    onSaveAi(keyInput.trim(), model);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-foreground">Settings</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">Workspace, agents, keys and backups.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onOpenOnboarding}>
          <Milestone />
          Open setup guide
        </Button>
      </header>

      <div>
        {folder && (
          <Section title="Workspace" description="Records live in workspace.json inside this folder.">
            <CopyChip value={folder.dir ?? ""} label="Copy folder path" />
          </Section>
        )}

        {folder ? (
          <Section title="Agent workspace" description="Claude Code, Codex and Cursor work these records. Their changes arrive in Review.">
            <Well className="divide-y divide-border p-0">
              {folderCommands.map(([command, what]) => (
                <div key={command} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
                  <code className="font-mono text-label text-foreground">{command}</code>
                  <span className="text-label text-faint-foreground">{what}</span>
                </div>
              ))}
            </Well>
            <Button variant="agent" size="sm" onClick={onOpenReview}>
              Open Review
            </Button>
            <HowItWorks>
              <p>
                Agents read the folder's <code className="font-mono text-foreground">AGENTS.md</code> and change records only through{" "}
                <code className="font-mono text-foreground">./crm</code> or the MCP server. What they propose waits in Review until you decide.
              </p>
            </HowItWorks>
          </Section>
        ) : (
          <Section title="Agent workspace" description="CLI agents cannot see this browser's local storage. Give them a Markdown snapshot.">
            <div className="space-y-2">
              <div className="text-label text-muted-foreground">Snapshot</div>
              <div className="flex flex-wrap items-center gap-2">
                {canPick ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={onConnectVault} disabled={syncBusy}>
                      <FolderSync />
                      {sync.vaultName ? "Choose another folder" : "Create workspace snapshot"}
                    </Button>
                    {sync.vaultName && (
                      <Button variant="secondary" size="sm" onClick={onSyncNow} disabled={syncBusy}>
                        {syncBusy ? "Syncing…" : "Sync now"}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={onDownloadMarkdown} disabled={syncBusy}>
                    <FileDown />
                    Download Markdown snapshot
                  </Button>
                )}
              </div>
              {sync.vaultName ? (
                <p className="flex flex-wrap items-center gap-x-2 text-label text-faint-foreground">
                  <span className="font-medium text-foreground">{sync.vaultName}</span>
                  <span aria-hidden>·</span>
                  <span className="tnum">
                    {sync.lastSyncedAt ? `${sync.fileCount ?? 0} files · synced ${formatRelative(sync.lastSyncedAt)}` : "connected · sync required"}
                  </span>
                </p>
              ) : (
                <p className="text-label text-faint-foreground">
                  {canPick ? "Pick an empty folder. Each sync writes one file per account." : "Move the file into a private folder, then open your agent there."}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-label text-muted-foreground">Starter request</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Button variant="agent" size="sm" onClick={onCopyAgentPrompt}>
                  <Copy />
                  Copy starter request
                </Button>
                <span className="text-label text-faint-foreground">
                  Paste it into <code className="font-mono text-muted-foreground">claude</code> or{" "}
                  <code className="font-mono text-muted-foreground">codex</code> in that folder.
                </span>
              </div>
            </div>

            <p className="text-label text-faint-foreground">
              The snapshot is one-way: agent edits don't update this CRM. For two-way work,{" "}
              <button onClick={onOpenReview} className="rounded-sm text-agent-fg underline-offset-2 hover:underline focus-visible:outline-none focus-visible:focus-ring">
                run Open CRM on a folder
              </button>
              .
            </p>

            <HowItWorks>
              <ol className="space-y-1.5">
                {[
                  ["Sync", "writes a current, source-grounded snapshot to a folder. No API key needed."],
                  ["Review", "open that folder in your agent and paste the starter request."],
                  ["Apply", "approve the useful work, record it here, then sync again."],
                ].map(([step, detail], i) => (
                  <li key={step} className="flex gap-2">
                    <span className="tnum text-faint-foreground">{i + 1}</span>
                    <span>
                      <span className="font-medium text-foreground">{step}</span> {detail}
                    </span>
                  </li>
                ))}
              </ol>
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-sunken p-3 font-mono text-label leading-5 text-muted-foreground">
                {agentPrompt}
              </pre>
            </HowItWorks>
          </Section>
        )}

        <Section title="Optional in-app AI" description="Account briefs and follow-up drafts with your own Anthropic key.">
          <Field label="Anthropic API key" hint="Stored only in this browser and sent directly to Anthropic, never to a Zentrik server.">
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-ant-…"
                className="pr-10 font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:focus-ring"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label="Model">
            <Select value={model} onChange={(e) => setModel(e.target.value as AiModel)}>
              {aiModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.note}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant={dirty ? "primary" : "secondary"} size="sm" onClick={save}>
              {saved ? <Check /> : <KeyRound />}
              {saved ? "Saved" : "Save key"}
            </Button>
            <Button variant="secondary" size="sm" onClick={onTestAi} disabled={!aiSettings.apiKey || aiTest.state === "testing" || dirty}>
              {aiTest.state === "testing" ? "Testing…" : "Test connection"}
            </Button>
            {aiSettings.apiKey && !dirty && (
              <Badge tone="success" dot>
                <span className="font-mono">{maskKey(aiSettings.apiKey)}</span>
              </Badge>
            )}
            {dirty && (keyInput.trim() || model !== aiSettings.model) && <span className="text-label text-faint-foreground">Unsaved changes</span>}
            {aiTest.state === "ok" && !dirty && <Badge tone="success" dot>Connected</Badge>}
            {aiTest.state === "error" && <span className="text-label text-destructive-fg">{aiTest.message}</span>}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 rounded-sm text-label text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:focus-ring"
            >
              Get an Anthropic API key
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </Section>

        <Section
          title="Data & backup"
          description={folder ? "Back up the folder like any other, or keep it under git." : "Records live in this browser. Export them to move or back up."}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onExport}>
              <FileDown />
              Export JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp />
              Import JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
          </div>
          {folder ? null : confirming ? (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive-bg p-3">
              <p className="text-body-sm text-destructive-fg">This clears local changes and restores the demo. It can't be undone.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive-solid" size="sm" onClick={() => { onReset(); setConfirming(false); }}>
                  <RefreshCcw />
                  Reset everything
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t border-border pt-4">
              <Button variant="ghost" size="sm" className="-ml-2 text-destructive-fg hover:bg-destructive-bg hover:text-destructive-fg" onClick={() => setConfirming(true)}>
                <RefreshCcw />
                Reset demo
              </Button>
            </div>
          )}
        </Section>

        <Section title="Share-safe view" description="The header switch removes these from the screen, never just blurs them.">
          <ul className="flex flex-wrap gap-2" aria-label="Hidden in share-safe view">
            {redactedFields.map((field) => (
              <li
                key={field}
                className="hatch-redact inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-border-strong px-2.5 text-label text-muted-foreground"
              >
                <EyeOff className="h-3 w-3" aria-hidden />
                {field}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="flex justify-end">
        <ZentrikMark />
      </div>
    </div>
  );
}
