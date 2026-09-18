import { useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  FolderSync,
  Milestone,
  KeyRound,
  RefreshCcw,
  Sparkles,
  Terminal,
} from "lucide-react";
import { aiModels, maskKey, type AiModel, type AiSettings } from "../lib/ai";
import { supportsDirectoryPicker, type SyncSettings } from "../lib/sync";
import { formatRelative } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Well } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { Badge } from "../components/ui/badge";
import { ZentrikMark } from "../components/zentrik-mark";

export type AiTest = { state: "idle" | "testing" | "ok" | "error"; message?: string };

const redactedFields = [
  "Revenue figures — ARR, deal values, and pipeline",
  "Account domains",
  "Contact names and emails",
  "Risk notes and note bodies",
  "Agent and account-data copy actions",
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
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-serif text-h1 text-foreground">Settings</h1>
        <p className="mt-0.5 text-body-sm text-muted-foreground">Setup, agents, keys, and data — under your control.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Milestone className="h-4 w-4 text-accent" />
            Getting started
          </CardTitle>
          <p className="text-body-sm text-muted-foreground">
            Reopen the local setup guide to create a focused workspace, import a backup, or explore the synthetic demo.
          </p>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" size="sm" onClick={onOpenOnboarding}>
            <Milestone />
            Open setup guide
          </Button>
        </CardContent>
      </Card>

      {folder ? (
        <Card className="border-agent/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-agent" />
              Agent workspace
            </CardTitle>
            <p className="text-body-sm text-muted-foreground">
              This CRM runs on a folder. Claude Code, Codex, and Cursor read its AGENTS.md and work the records through the{" "}
              <code className="font-mono text-foreground">./crm</code> command or the MCP server. What they change arrives under Review.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Well className="font-mono text-[12px] text-foreground">{folder.dir}</Well>
            <pre className="overflow-x-auto rounded-md border border-border bg-surface-sunken p-3 font-mono text-[11px] leading-5 text-muted-foreground">
              {["./crm status        what needs attention, and why", "./crm help          every command", "claude | codex      start an agent in this folder"].join("\n")}
            </pre>
            <Button variant="agent" size="sm" onClick={onOpenReview}>
              Open Review
            </Button>
          </CardContent>
        </Card>
      ) : (
      <Card className="border-agent/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-agent" />
            Agent workspace
          </CardTitle>
          <p className="text-body-sm text-muted-foreground">
            Codex, Claude Code, and other CLI agents cannot see this browser's local storage. Give them a current,
            source-grounded Markdown snapshot instead. No API key is required.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            {[
              ["1", "Sync", "Write a current snapshot to a dedicated folder."],
              ["2", "Review", "Open that folder in your agent and paste the request."],
              ["3", "Apply", "Approve the useful work and record it in the CRM."],
            ].map(([step, label, detail]) => (
              <li key={step} className="bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-agent-bg font-mono text-[11px] text-agent-fg">
                    {step}
                  </span>
                  <span className="text-h3 text-foreground">{label}</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{detail}</p>
              </li>
            ))}
          </ol>

          <div className="space-y-2">
            <div className="text-label uppercase text-muted-foreground">1 · Create the readable snapshot</div>
            <div className="flex flex-wrap items-center gap-2">
              {canPick ? (
                <>
                  <Button variant="secondary" size="sm" onClick={onConnectVault} disabled={syncBusy}>
                    <FolderSync />
                    {sync.vaultName ? "Choose another folder" : "Create workspace snapshot"}
                  </Button>
                  {sync.vaultName && (
                    <Button variant="primary" size="sm" onClick={onSyncNow} disabled={syncBusy}>
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
              <Well className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
                <span className="text-foreground">
                  Folder: <span className="font-medium">{sync.vaultName}</span>
                </span>
                <span className="text-faint-foreground">
                  {sync.lastSyncedAt
                    ? `${sync.fileCount ?? 0} files · synced ${formatRelative(sync.lastSyncedAt)}`
                    : "connected · sync required"}
                </span>
              </Well>
            ) : (
              <p className="text-[12px] text-faint-foreground">
                {canPick
                  ? "Choose a dedicated folder such as open-crm-workspace. Each sync writes an index, an agent guide, and one file per account."
                  : "Move the downloaded file into a private working folder before opening your CLI agent there."}
              </p>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-label uppercase text-muted-foreground">2 · Start a grounded review</div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Open the snapshot folder, run <code className="font-mono text-foreground">codex</code> or{" "}
                  <code className="font-mono text-foreground">claude</code>, then paste this request.
                </p>
              </div>
              <Button variant="agent" size="sm" onClick={onCopyAgentPrompt}>
                <Copy />
                Copy starter request
              </Button>
            </div>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface-sunken p-3 font-mono text-[11px] leading-5 text-muted-foreground">
              {agentPrompt}
            </pre>
          </div>

          <div className="border-t border-border pt-3 text-[12px] leading-5 text-muted-foreground">
            The snapshot is one-way: agent edits do not update the browser CRM. Review the result, record accepted actions
            here, then sync again before the next agent session. For two-way work, where agents capture notes and propose
            next actions you approve,{" "}
            <button onClick={onOpenReview} className="rounded-sm text-agent-fg underline-offset-2 hover:underline focus-visible:outline-none focus-visible:focus-ring">
              run Open CRM on a folder
            </button>
            .
          </div>
        </CardContent>
      </Card>
      )}

      {/* AI & API keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-agent" />
            Optional in-app AI
          </CardTitle>
          <p className="text-body-sm text-muted-foreground">
            Bring your own Anthropic key to generate account briefs and follow-up drafts inside the account view. This is
            separate from the CLI agent workspace above. The key is stored only in this
            browser's local storage and sent directly to Anthropic — never to a Zentrik server.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Anthropic API key" hint="Find it at console.anthropic.com → API keys.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-ant-…"
                  className="pr-9 font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:focus-ring"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
            <Button variant="primary" size="sm" onClick={save}>
              {saved ? <Check /> : <KeyRound />}
              {saved ? "Saved" : "Save key"}
            </Button>
            <Button variant="agent" size="sm" onClick={onTestAi} disabled={!aiSettings.apiKey || aiTest.state === "testing" || dirty}>
              {aiTest.state === "testing" ? "Testing…" : "Test connection"}
            </Button>
            {aiSettings.apiKey && !dirty && (
              <Badge tone="success" dot>
                Key saved · {maskKey(aiSettings.apiKey)}
              </Badge>
            )}
            {dirty && (keyInput.trim() || model !== aiSettings.model) && <span className="text-[12px] text-faint-foreground">Unsaved changes</span>}
            {aiTest.state === "ok" && !dirty && <Badge tone="success" dot>Connected</Badge>}
            {aiTest.state === "error" && <span className="text-[12px] text-destructive-fg">{aiTest.message}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle>Local data</CardTitle>
          <p className="text-body-sm text-muted-foreground">
            {folder
              ? "Your workspace lives in workspace.json in the folder above. Back it up like any folder, or keep it under git."
              : "Your workspace lives in this browser's local storage. Export it to move or back up."}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={onExport}>
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
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive-bg/40 p-3">
              <p className="text-[12px] text-destructive-fg">This clears local changes and restores the demo. Can't be undone.</p>
              <div className="flex gap-2">
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
            <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              <RefreshCcw />
              Reset demo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy boundary</CardTitle>
          <p className="text-body-sm text-muted-foreground">
            The header's Private↔Share-safe toggle redacts these fields at render time (never a blur that can flash) so you
            can screen-share or demo safely.
          </p>
        </CardHeader>
        <CardContent>
          <Well className="space-y-2">
            <div className="flex items-center gap-1.5 text-label uppercase text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" />
              Hidden in share-safe view
            </div>
            {redactedFields.map((field) => (
              <div key={field} className="flex items-center gap-2 text-body-sm text-foreground">
                <span className="hatch-redact h-3 w-3 rounded-sm border border-dashed border-border-strong" aria-hidden />
                {field}
              </div>
            ))}
          </Well>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-accent-fg"
        >
          Get an Anthropic API key
          <ExternalLink className="h-3 w-3" />
        </a>
        <ZentrikMark tone="prominent" />
      </div>
    </div>
  );
}
