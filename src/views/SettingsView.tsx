import { useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  FolderSync,
  KeyRound,
  RefreshCcw,
  Sparkles,
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

const redactedFields = ["Revenue figures — ARR, deal values, and pipeline", "Account domains", "Contact names and emails", "Risk notes"];

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
  onExport,
  onImport,
  onReset,
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
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
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
        <p className="mt-0.5 text-body-sm text-muted-foreground">Keys, integrations, and data — all local to this browser.</p>
      </div>

      {/* AI & API keys */}
      <Card className="border-agent/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-agent" />
            AI & API keys
          </CardTitle>
          <p className="text-body-sm text-muted-foreground">
            Bring your own Anthropic key to unlock account briefs and follow-up drafts. The key is stored only in this
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

      {/* Integrations / Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderSync className="h-4 w-4 text-accent" />
            Integrations · Markdown vault
          </CardTitle>
          <p className="text-body-sm text-muted-foreground">
            Sync accounts and notes as Markdown into an Obsidian-style vault, so your CRM works alongside the rest of your
            system. One <code className="font-mono text-[12px]">.md</code> per account, with frontmatter.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {canPick ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={onConnectVault} disabled={syncBusy}>
                  <FolderSync />
                  {sync.vaultName ? "Reconnect vault folder" : "Connect vault folder"}
                </Button>
                {sync.vaultName && (
                  <Button variant="primary" size="sm" onClick={onSyncNow} disabled={syncBusy}>
                    {syncBusy ? "Syncing…" : "Sync now"}
                  </Button>
                )}
              </div>
              {sync.vaultName ? (
                <Well className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
                  <span className="text-foreground">
                    Vault: <span className="font-medium">{sync.vaultName}</span>
                  </span>
                  <span className="text-faint-foreground">
                    {sync.lastSyncedAt
                      ? `${sync.fileCount ?? 0} files · synced ${formatRelative(sync.lastSyncedAt)}`
                      : "not synced yet"}
                  </span>
                </Well>
              ) : (
                <p className="text-[12px] text-faint-foreground">
                  Pick your Obsidian vault (or any folder). Files are written directly into it on each sync.
                </p>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onDownloadMarkdown} disabled={syncBusy}>
                <FileDown />
                Download Markdown
              </Button>
              <p className="text-[12px] text-faint-foreground">
                This browser doesn't support writing directly to a folder. Download a combined Markdown file instead, or use
                a Chromium-based browser to sync into a vault folder.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle>Local data</CardTitle>
          <p className="text-body-sm text-muted-foreground">Your workspace lives in this browser's local storage. Export it to move or back up.</p>
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
          {confirming ? (
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
