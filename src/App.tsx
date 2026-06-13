import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Layers3, Lock, Moon, Search, Sun } from "lucide-react";
import { loadWorkspace, resetWorkspace, saveWorkspace, touchWorkspace } from "./lib/storage";
import { cn, makeId } from "./lib/utils";
import { primaryNav, secondaryNav, allNav, type View } from "./lib/nav";
import { isOpenDeal, pipelineColumns } from "./lib/meta";
import {
  emptyAccountDraft,
  emptyContactDraft,
  type AccountDraft,
  type ContactDraft,
  type DealDraft,
  type NoteDraft,
  type TaskDraft,
} from "./lib/drafts";
import {
  aiModels,
  generateAccountBrief,
  generateAnswer,
  generateFollowUp,
  hasAiKey,
  loadAiSettings,
  saveAiSettings,
  testConnection,
  type AiModel,
  type AiSettings,
} from "./lib/ai";
import {
  accountToMarkdown,
  buildVaultFiles,
  downloadCombinedMarkdown,
  loadSyncSettings,
  pickVault,
  saveSyncSettings,
  writeVault,
  type SyncSettings,
} from "./lib/sync";
import { downloadICS, tasksToICS } from "./lib/ics";
import { createGitHubIssueDraft, type FeedbackDraft } from "./lib/feedback";
import type { Account, Deal, DealStage, Note, Task, Workspace } from "./types";
import { PrivacyProvider } from "./components/ui/privacy";
import { ToastProvider, useToast } from "./components/ui/toast";
import { NavItem } from "./components/ui/nav-item";
import { Button } from "./components/ui/button";
import { Kbd } from "./components/ui/kbd";
import { CommandPalette } from "./components/command-palette";
import { ZentrikMark } from "./components/zentrik-mark";
import { HomeView } from "./views/HomeView";
import { PipelineView } from "./views/PipelineView";
import { AccountsView, type AiViewState } from "./views/AccountsView";
import { ContactsView } from "./views/ContactsView";
import { TasksView } from "./views/TasksView";
import { NotesView } from "./views/NotesView";
import { SettingsView, type AiTest } from "./views/SettingsView";
import { ImproveView } from "./views/ImproveView";
import type { AiKind } from "./components/ai-panel";

type AiState = { busy: AiKind | null; result: { kind: AiKind; text: string } | null; copied: boolean; error: string | null };
const emptyAi: AiState = { busy: null, result: null, copied: false, error: null };
const DAY = 24 * 60 * 60 * 1000;
const stageProbability: Record<DealStage, number> = { lead: 20, qualified: 35, proposal: 55, negotiation: 75, won: 100, lost: 0 };

/** Parse a <input type=date> "YYYY-MM-DD" as LOCAL end-of-day, so "due today"
 *  isn't read as overdue for users behind UTC. */
function endOfDayISO(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59).toISOString();
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const toast = useToast();
  const [workspace, setWorkspace] = useState<Workspace>(() => loadWorkspace());
  const [view, setView] = useState<View>("home");
  const [buildroom, setBuildroom] = useState(false);
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const enterRaf = useRef(0);
  const [selectedAccountId, setSelectedAccountId] = useState(workspace.accounts[0]?.id ?? "");
  const [draftAccount, setDraftAccount] = useState<AccountDraft>(emptyAccountDraft);
  const [draftContact, setDraftContact] = useState<ContactDraft>(emptyContactDraft);

  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [aiTest, setAiTest] = useState<AiTest>({ state: "idle" });
  const [ai, setAi] = useState<AiState>(emptyAi);
  const aiAbort = useRef<AbortController | null>(null);

  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => loadSyncSettings());
  const [syncBusy, setSyncBusy] = useState(false);
  const vaultHandle = useRef<Awaited<ReturnType<typeof pickVault>> | null>(null);

  const [issueDraft, setIssueDraft] = useState<{ title: string; body: string } | null>(null);
  const [issueCopied, setIssueCopied] = useState(false);

  useEffect(() => saveWorkspace(workspace), [workspace]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);
  // Page-transition: fade+rise the content region on view change without
  // remounting the views (so rings/meters/count-ups never replay).
  useEffect(() => {
    if (!entering) return;
    cancelAnimationFrame(enterRaf.current);
    enterRaf.current = requestAnimationFrame(() => requestAnimationFrame(() => setEntering(false)));
    return () => cancelAnimationFrame(enterRaf.current);
  }, [entering]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const accountsById = useMemo(() => new Map(workspace.accounts.map((a) => [a.id, a])), [workspace.accounts]);
  const selectedAccount = accountsById.get(selectedAccountId) ?? workspace.accounts[0];

  const counts = useMemo(
    () => ({
      pipeline: workspace.deals.filter((d) => isOpenDeal(d.stage)).length,
      accounts: workspace.accounts.length,
      contacts: workspace.accounts.reduce((s, a) => s + a.contacts.length, 0),
      tasks: workspace.tasks.filter((t) => t.status === "open").length,
      notes: workspace.notes.length,
    }),
    [workspace],
  );

  const homeMetrics = useMemo(() => {
    const now = Date.now();
    const weightedPipeline = workspace.deals
      .filter((d) => isOpenDeal(d.stage))
      .reduce((s, d) => s + (d.value * d.probability) / 100, 0);
    const openTasks = workspace.tasks.filter((t) => t.status === "open");
    return {
      weightedPipeline,
      openDeals: counts.pipeline,
      openTasks: openTasks.length,
      dueSoon: openTasks.filter((t) => {
        const diff = new Date(t.due).getTime() - now;
        return diff >= 0 && diff < 3 * DAY;
      }).length,
      atRisk: workspace.accounts.filter((a) => a.stage === "at_risk").length,
    };
  }, [workspace, counts.pipeline]);

  /* ---- navigation ---- */
  function navigate(next: View) {
    if (next === view) return;
    setView(next);
    setEntering(true);
  }
  function selectAccount(id: string) {
    setSelectedAccountId(id);
    setAi(emptyAi);
    aiAbort.current?.abort();
  }
  function selectAccountAndOpen(id: string) {
    selectAccount(id);
    navigate("accounts");
  }
  function toggleBuildroom() {
    setBuildroom((value) => {
      const next = !value;
      toast(
        next
          ? { title: "Share-safe view — revenue, domains, contact names, risk notes, and note bodies are hidden.", tone: "accent", icon: Eye }
          : { title: "Private view — full account detail is visible.", tone: "neutral", icon: Lock },
      );
      return next;
    });
  }

  /* ---- CRM mutations ---- */
  function toggleTask(id: string) {
    const task = workspace.tasks.find((t) => t.id === id);
    setWorkspace((cur) =>
      touchWorkspace({
        ...cur,
        tasks: cur.tasks.map((t) =>
          t.id === id
            ? { ...t, status: t.status === "done" ? "open" : "done", completedAt: t.status === "done" ? undefined : new Date().toISOString() }
            : t,
        ),
      }),
    );
    if (task && task.status === "open") toast({ title: `Done · ${task.title}`, tone: "success" });
  }

  function addTask(draft: TaskDraft) {
    if (!draft.title.trim()) return;
    const account = accountsById.get(draft.accountId);
    const task: Task = {
      id: makeId("task"),
      title: draft.title.trim(),
      accountId: draft.accountId || undefined,
      due: draft.due ? endOfDayISO(draft.due) : new Date(Date.now() + 3 * DAY).toISOString(),
      owner: draft.owner || account?.owner || "Unassigned",
      priority: draft.priority,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    setWorkspace((cur) => touchWorkspace({ ...cur, tasks: [task, ...cur.tasks] }));
    toast({ title: "Task added", tone: "signal" });
  }

  function addNote(draft: NoteDraft) {
    if (!draft.title.trim() || !draft.body.trim()) return;
    const note: Note = {
      id: makeId("note"),
      accountId: draft.accountId,
      contactId: draft.contactId || undefined,
      source: draft.source,
      title: draft.title.trim(),
      body: draft.body.trim(),
      sentiment: "neutral",
      createdAt: new Date().toISOString(),
      sourceRef: "Manual entry",
    };
    setWorkspace((cur) =>
      touchWorkspace({
        ...cur,
        notes: [note, ...cur.notes],
        accounts: cur.accounts.map((a) => (a.id === draft.accountId ? { ...a, lastTouch: note.createdAt } : a)),
      }),
    );
    toast({ title: "Note captured", tone: "signal" });
  }

  function addDeal(draft: DealDraft) {
    if (!draft.name.trim() || !draft.accountId) return;
    const account = accountsById.get(draft.accountId);
    const deal: Deal = {
      id: makeId("deal"),
      accountId: draft.accountId,
      name: draft.name.trim(),
      stage: draft.stage,
      value: Number(draft.value) || 0,
      owner: draft.owner || account?.owner || "Unassigned",
      closeDate: draft.closeDate ? endOfDayISO(draft.closeDate) : new Date(Date.now() + 30 * DAY).toISOString(),
      probability: stageProbability[draft.stage],
      createdAt: new Date().toISOString(),
    };
    setWorkspace((cur) => touchWorkspace({ ...cur, deals: [deal, ...cur.deals] }));
    toast({ title: `Deal added · ${deal.name}`, tone: "account" });
  }

  function advanceDeal(id: string) {
    const deal = workspace.deals.find((d) => d.id === id);
    if (!deal) return;
    const i = pipelineColumns.indexOf(deal.stage);
    if (i < 0 || i >= pipelineColumns.length - 1) return;
    const next = pipelineColumns[i + 1];
    setWorkspace((cur) =>
      touchWorkspace({
        ...cur,
        deals: cur.deals.map((d) => (d.id === id ? { ...d, stage: next, probability: stageProbability[next] } : d)),
      }),
    );
    toast({ title: `${deal.name} → ${next}`, tone: next === "won" ? "success" : "account" });
  }

  function loseDeal(id: string) {
    const deal = workspace.deals.find((d) => d.id === id);
    if (!deal) return;
    setWorkspace((cur) =>
      touchWorkspace({ ...cur, deals: cur.deals.map((d) => (d.id === id ? { ...d, stage: "lost", probability: 0 } : d)) }),
    );
    toast({ title: `${deal.name} marked lost`, tone: "neutral" });
  }

  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftAccount.name.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const owner = draftAccount.owner.trim() || "Unassigned";
    const accountId = makeId("acct");
    const contactName = draftAccount.contactName.trim();
    const contactRole = draftAccount.contactRole.trim();
    const domain =
      draftAccount.domain.trim() ||
      `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account"}.example`;
    const account: Account = {
      id: accountId,
      name,
      domain,
      segment: draftAccount.segment.trim() || "New relationship",
      stage: draftAccount.stage,
      priority: draftAccount.priority,
      arr: 0,
      health: 70,
      fit: 70,
      sourceConfidence: 35,
      owner,
      tags: ["new account"],
      contacts:
        contactName && contactRole
          ? [{ id: makeId("contact"), name: contactName, role: contactRole, influence: "champion" as const, lastSeen: now }]
          : [],
      needs: ["Needs discovery"],
      risks: ["No recent note captured yet"],
      lastTouch: now,
      createdAt: now,
    };
    setWorkspace((cur) => touchWorkspace({ ...cur, accounts: [account, ...cur.accounts] }));
    setSelectedAccountId(accountId);
    setDraftAccount(emptyAccountDraft);
    setAi(emptyAi);
    toast({ title: `Account added · ${name}`, tone: "success" });
  }

  function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accountId = selectedAccount?.id;
    const name = draftContact.name.trim();
    const role = draftContact.role.trim();
    if (!accountId || !name || !role || !selectedAccount) return;
    const now = new Date().toISOString();
    const contact = { id: makeId("contact"), name, role, influence: draftContact.influence, email: draftContact.email.trim() || undefined, lastSeen: now };
    setWorkspace((cur) =>
      touchWorkspace({
        ...cur,
        accounts: cur.accounts.map((a) => (a.id === accountId ? { ...a, contacts: [...a.contacts, contact], lastTouch: now } : a)),
      }),
    );
    setDraftContact(emptyContactDraft);
    toast({ title: `Contact added · ${name}`, tone: "account" });
  }

  /* ---- AI ---- */
  const modelLabel = aiModels.find((m) => m.id === aiSettings.model)?.label ?? aiSettings.model;
  function aiCtxFor(account: Account) {
    return {
      account,
      notes: workspace.notes.filter((n) => n.accountId === account.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      deals: workspace.deals.filter((d) => d.accountId === account.id),
      tasks: workspace.tasks.filter((t) => t.accountId === account.id),
      contact: account.contacts[0],
    };
  }
  async function runAi(kind: AiKind, fn: (ctrl: AbortController) => Promise<string>) {
    if (!selectedAccount || !hasAiKey(aiSettings)) return;
    aiAbort.current?.abort();
    const ctrl = new AbortController();
    aiAbort.current = ctrl;
    setAi({ busy: kind, result: null, copied: false, error: null });
    try {
      const text = await fn(ctrl);
      if (ctrl.signal.aborted) return;
      setAi({ busy: null, result: { kind, text }, copied: false, error: null });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setAi({ busy: null, result: null, copied: false, error: err instanceof Error ? err.message : "AI request failed." });
    }
  }
  function aiGenerate(kind: AiKind) {
    if (!selectedAccount) return;
    const ctx = aiCtxFor(selectedAccount);
    runAi(kind, (ctrl) => (kind === "brief" ? generateAccountBrief(aiSettings, ctx, ctrl.signal) : generateFollowUp(aiSettings, ctx, ctrl.signal)));
  }
  function aiAsk(question: string) {
    if (!selectedAccount) return;
    const ctx = aiCtxFor(selectedAccount);
    runAi("ask", (ctrl) => generateAnswer(aiSettings, ctx, question, ctrl.signal));
  }
  async function aiCopy() {
    if (!ai.result) return;
    try {
      await navigator.clipboard.writeText(ai.result.text);
      setAi((s) => ({ ...s, copied: true }));
      window.setTimeout(() => setAi((s) => ({ ...s, copied: false })), 1600);
    } catch {
      /* ignore */
    }
  }
  function saveAi(apiKey: string, model: AiModel) {
    const next = { apiKey, model };
    setAiSettings(next);
    saveAiSettings(next);
    setAiTest({ state: "idle" });
    toast({ title: apiKey ? "API key saved (local only)" : "API key cleared", tone: apiKey ? "success" : "neutral" });
  }
  async function testAi() {
    if (!hasAiKey(aiSettings)) return;
    setAiTest({ state: "testing" });
    try {
      await testConnection(aiSettings);
      setAiTest({ state: "ok" });
    } catch (err) {
      setAiTest({ state: "error", message: err instanceof Error ? err.message : "Connection failed." });
    }
  }

  /* ---- Sync + data ---- */
  async function connectVault() {
    try {
      const handle = await pickVault();
      vaultHandle.current = handle;
      const next = { ...syncSettings, vaultName: handle.name };
      setSyncSettings(next);
      saveSyncSettings(next);
      toast({ title: `Vault connected · ${handle.name}`, tone: "accent" });
    } catch {
      /* user cancelled */
    }
  }
  async function syncNow() {
    if (!vaultHandle.current) {
      await connectVault();
      if (!vaultHandle.current) return;
    }
    setSyncBusy(true);
    try {
      const count = await writeVault(vaultHandle.current, buildVaultFiles(workspace));
      const next = { ...syncSettings, vaultName: vaultHandle.current.name, lastSyncedAt: new Date().toISOString(), fileCount: count };
      setSyncSettings(next);
      saveSyncSettings(next);
      toast({ title: `Synced ${count} Markdown files to your vault`, tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Sync failed.", tone: "destructive" });
    } finally {
      setSyncBusy(false);
    }
  }
  function downloadMarkdown() {
    const count = downloadCombinedMarkdown(workspace);
    toast({ title: `Downloaded Markdown for ${count} files`, tone: "success" });
  }
  async function copyAccountMarkdown() {
    if (!selectedAccount) return;
    const md = accountToMarkdown(
      selectedAccount,
      workspace.deals.filter((d) => d.accountId === selectedAccount.id),
      workspace.tasks.filter((t) => t.accountId === selectedAccount.id),
      workspace.notes.filter((n) => n.accountId === selectedAccount.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
    try {
      await navigator.clipboard.writeText(md);
      toast({ title: "Account copied as Markdown", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy to clipboard.", tone: "destructive" });
    }
  }
  function exportTasksICS() {
    const open = workspace.tasks.filter((t) => t.status === "open");
    downloadICS(tasksToICS(open, accountsById));
    toast({ title: `Exported ${open.length} tasks to calendar (.ics)`, tone: "success" });
  }
  function exportWorkspace() {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "open-crm-workspace.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Workspace exported", tone: "success" });
  }
  async function importWorkspace(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Workspace;
      if (!Array.isArray(parsed.accounts)) throw new Error("not a workspace file");
      setWorkspace(touchWorkspace(parsed));
      setSelectedAccountId(parsed.accounts[0]?.id ?? "");
      toast({ title: "Workspace imported", tone: "success" });
    } catch {
      toast({ title: "That file isn't a valid Open CRM workspace.", tone: "destructive" });
    }
  }
  function handleReset() {
    const reset = resetWorkspace();
    setWorkspace(reset);
    setSelectedAccountId(reset.accounts[0]?.id ?? "");
    setAi(emptyAi);
    toast({ title: "Workspace reset to the demo", tone: "warning" });
  }

  /* ---- Improve ---- */
  function approveIdea(id: string) {
    const idea = workspace.ideas.find((i) => i.id === id);
    setWorkspace((cur) =>
      touchWorkspace({
        ...cur,
        ideas: cur.ideas.map((i) =>
          i.id === id
            ? { ...i, status: i.status === "candidate" ? "shaping" : i.status === "shaping" ? "queued" : "released", votes: i.votes + 1, confidence: Math.min(99, i.confidence + 3) }
            : i,
        ),
      }),
    );
    if (idea) toast({ title: `Advanced · ${idea.title}`, tone: "idea" });
  }
  function submitFeedback(draft: FeedbackDraft) {
    if (!draft.title.trim() || !draft.body.trim()) return;
    const idea = {
      id: makeId("idea"),
      title: draft.title.trim(),
      problem: draft.body.trim(),
      status: "candidate" as const,
      votes: 1,
      targetRelease: "triage",
      confidence: 60,
    };
    setWorkspace((cur) => touchWorkspace({ ...cur, ideas: [idea, ...cur.ideas] }));
    setIssueDraft(createGitHubIssueDraft(draft));
    setIssueCopied(false);
    toast({ title: "Thanks — added to the roadmap as a candidate.", tone: "idea" });
  }
  async function copyIssueDraft() {
    if (!issueDraft) return;
    try {
      await navigator.clipboard.writeText(`# ${issueDraft.title}\n\n${issueDraft.body}`);
      setIssueCopied(true);
      window.setTimeout(() => setIssueCopied(false), 1600);
      toast({ title: "Issue draft copied", tone: "success" });
    } catch {
      /* ignore */
    }
  }

  const aiView: AiViewState = {
    hasKey: hasAiKey(aiSettings),
    modelLabel,
    busy: ai.busy,
    result: ai.result,
    copied: ai.copied,
    error: ai.error,
  };

  const countFor = (id: View): number | undefined =>
    id === "pipeline" ? counts.pipeline
    : id === "accounts" ? counts.accounts
    : id === "contacts" ? counts.contacts
    : id === "tasks" ? counts.tasks
    : id === "notes" ? counts.notes
    : undefined;

  return (
    <PrivacyProvider buildroom={buildroom}>
      <div className="app-grid bg-background">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface/60 px-3.5 py-5 lg:flex">
          <div className="mb-7 flex items-center gap-2.5 px-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layers3 className="h-[18px] w-[18px]" />
            </span>
            <div className="leading-tight">
              <div className="font-serif text-[15px] font-medium text-foreground">Open CRM</div>
              <div className="text-[11px] text-muted-foreground">Local-first workspace</div>
            </div>
          </div>

          <nav aria-label="Primary" className="space-y-0.5">
            {primaryNav.map((item) => (
              <NavItem key={item.id} icon={item.icon} label={item.label} active={view === item.id} count={countFor(item.id)} onClick={() => navigate(item.id)} />
            ))}
          </nav>

          <div className="my-3 border-t border-border" />

          <nav aria-label="Workspace" className="space-y-0.5">
            {secondaryNav.map((item) => (
              <NavItem key={item.id} icon={item.icon} label={item.label} active={view === item.id} onClick={() => navigate(item.id)} />
            ))}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                Local-first
              </div>
              <p className="text-[11px] leading-4 text-muted-foreground">
                Your data stays in this browser. AI runs on your own key; sync writes to your own vault.
              </p>
            </div>
            <div className="border-t border-border px-1 pt-3">
              <ZentrikMark />
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground lg:hidden">
                  <Layers3 className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate font-serif text-[15px] font-medium text-foreground">{workspace.name}</h1>
                  <p className="truncate text-[11px] text-muted-foreground">{workspace.edition} · local-first</p>
                </div>
              </div>

              <button
                onClick={() => setPaletteOpen(true)}
                aria-label="Open command palette"
                className="hidden h-9 min-w-[240px] items-center gap-2 rounded-md border border-border bg-surface-sunken px-3 text-body-sm text-muted-foreground transition-colors duration-fast ease-out hover:border-border-strong focus-visible:outline-none focus-visible:focus-ring sm:flex"
              >
                <Search className="h-4 w-4" />
                <span>Search accounts, deals, tasks…</span>
                <Kbd keys={["⌘", "K"]} className="ml-auto" />
              </button>

              <Button size="icon" variant="ghost" onClick={() => setPaletteOpen(true)} className="h-9 w-9 sm:hidden" aria-label="Search">
                <Search />
              </Button>
              <Button size="sm" variant={buildroom ? "accent" : "secondary"} onClick={toggleBuildroom}>
                {buildroom ? <Eye /> : <Lock />}
                {buildroom ? "Share-safe" : "Private"}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDarkMode((v) => !v)} aria-label="Toggle theme" className="h-9 w-9">
                {darkMode ? <Sun /> : <Moon />}
              </Button>
            </div>

            <nav aria-label="Primary" className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 lg:hidden">
              {allNav.map((item) => {
                const Icon = item.icon;
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-10 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:focus-ring",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    <span className={cn("absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-accent transition-opacity", active ? "opacity-100" : "opacity-0")} aria-hidden />
                  </button>
                );
              })}
            </nav>
          </header>

          <div
            className={cn(
              "mx-auto max-w-7xl px-4 py-6 transition-[opacity,transform] duration-base ease-out lg:px-6 motion-reduce:transition-none",
              entering ? "translate-y-1.5 opacity-0" : "translate-y-0 opacity-100",
            )}
          >
            <div data-view="home" className={cn(view !== "home" && "hidden")}>
              <HomeView workspace={workspace} accountsById={accountsById} metrics={homeMetrics} onNavigate={navigate} onSelectAccount={selectAccountAndOpen} onToggleTask={toggleTask} />
            </div>
            <div data-view="pipeline" className={cn(view !== "pipeline" && "hidden")}>
              <PipelineView deals={workspace.deals} accounts={workspace.accounts} accountsById={accountsById} onAdvanceDeal={advanceDeal} onLoseDeal={loseDeal} onSelectAccount={selectAccountAndOpen} onAddDeal={addDeal} />
            </div>
            <div data-view="accounts" className={cn(view !== "accounts" && "hidden")}>
              <AccountsView
                accounts={workspace.accounts}
                selectedAccount={selectedAccount}
                deals={workspace.deals}
                tasks={workspace.tasks}
                notes={workspace.notes}
                draftAccount={draftAccount}
                draftContact={draftContact}
                setDraftAccount={setDraftAccount}
                setDraftContact={setDraftContact}
                onAddAccount={addAccount}
                onAddContact={addContact}
                onSelectAccount={selectAccount}
                onAdvanceDeal={advanceDeal}
                onLoseDeal={loseDeal}
                onToggleTask={toggleTask}
                ai={aiView}
                onAiGenerate={aiGenerate}
                onAiAsk={aiAsk}
                onAiCopy={aiCopy}
                onAiClear={() => setAi(emptyAi)}
                onCopyMarkdown={copyAccountMarkdown}
                onOpenSettings={() => navigate("settings")}
              />
            </div>
            <div data-view="contacts" className={cn(view !== "contacts" && "hidden")}>
              <ContactsView accounts={workspace.accounts} onSelectAccount={selectAccountAndOpen} />
            </div>
            <div data-view="tasks" className={cn(view !== "tasks" && "hidden")}>
              <TasksView tasks={workspace.tasks} accounts={workspace.accounts} accountsById={accountsById} onToggleTask={toggleTask} onAddTask={addTask} onSelectAccount={selectAccountAndOpen} onExportICS={exportTasksICS} />
            </div>
            <div data-view="notes" className={cn(view !== "notes" && "hidden")}>
              <NotesView notes={workspace.notes} accounts={workspace.accounts} accountsById={accountsById} onAddNote={addNote} />
            </div>
            <div data-view="settings" className={cn(view !== "settings" && "hidden")}>
              <SettingsView
                aiSettings={aiSettings}
                onSaveAi={saveAi}
                aiTest={aiTest}
                onTestAi={testAi}
                sync={syncSettings}
                syncBusy={syncBusy}
                onConnectVault={connectVault}
                onSyncNow={syncNow}
                onDownloadMarkdown={downloadMarkdown}
                onExport={exportWorkspace}
                onImport={importWorkspace}
                onReset={handleReset}
              />
            </div>
            <div data-view="improve" className={cn(view !== "improve" && "hidden")}>
              <ImproveView
                ideas={workspace.ideas}
                changelog={workspace.changelog}
                onApproveIdea={approveIdea}
                onSubmitFeedback={submitFeedback}
                issueDraft={issueDraft}
                copied={issueCopied}
                onCopyIssueDraft={copyIssueDraft}
              />
            </div>
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        accounts={workspace.accounts}
        deals={workspace.deals}
        notes={workspace.notes}
        tasks={workspace.tasks}
        buildroom={buildroom}
        onNavigate={navigate}
        onSelectAccount={selectAccountAndOpen}
        onTogglePrivacy={toggleBuildroom}
      />
    </PrivacyProvider>
  );
}
