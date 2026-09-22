import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Layers3, Lock, Moon, Search, Sun } from "lucide-react";
import { createDemoWorkspace, getStorageIssue, getStoredWorkspaceText, hasStoredWorkspace, loadWorkspace, recoverWorkspace, saveWorkspace, touchWorkspace } from "./lib/storage";
import { loadOnboardingState, saveOnboardingState, type OnboardingMode, type OnboardingState } from "./lib/onboarding";
import { cn, makeId } from "./lib/utils";
import { primaryNav, secondaryNav, allNav, type View } from "./lib/nav";
import { isOpenDeal, pipelineColumns } from "./lib/meta";
import { newChange, pendingProposals, resolveProposal, submitChange } from "./core/ops.ts";
import { normalizeWorkspace, parseWorkspace } from "./core/validate.ts";
import { accountMemory, briefMarkdown, trace as traceRecord } from "./core/memory.ts";
import { TraceSheet } from "./components/trace";
import { BackendError, folderBacked, loadFolder, replaceFolderWorkspace, sendChange, sendDecision, watchFolder, type FolderState } from "./lib/backend";
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
import { buildAccountAgentHandoff, buildWorkspaceAgentStarterPrompt } from "./lib/agent";
import type { Account, AgentMode, Change, Op, Workspace } from "./types";
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
import { ReviewView } from "./views/ReviewView";
import { BookView } from "./views/BookView";
import { brand } from "./lib/brand";
import { OnboardingView, type WorkspaceSetupDraft } from "./views/OnboardingView";
import { seedWorkspace } from "./data/seed";
import type { AiKind } from "./components/ai-panel";

type AiState = { busy: AiKind | null; result: { kind: AiKind; text: string } | null; copied: boolean; error: string | null };
const emptyAi: AiState = { busy: null, result: null, copied: false, error: null };
const DAY = 24 * 60 * 60 * 1000;
const viewTitles: Record<View, string> = {
  home: "Home",
  book: "Book",
  pipeline: "Pipeline",
  accounts: "Accounts",
  contacts: "Contacts",
  tasks: "Tasks",
  notes: "Notes",
  review: "Review",
  settings: "Settings",
  improve: "Improve",
};

/** What the app shows for the instant before a workspace folder has loaded. */
const blankWorkspace: Workspace = normalizeWorkspace({
  name: brand.name,
  edition: "Self-Hosted",
  updatedAt: new Date(0).toISOString(),
  accounts: [],
  deals: [],
  tasks: [],
  notes: [],
  ideas: [],
  changelog: [],
});

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const toast = useToast();
  const [workspace, setWorkspace] = useState<Workspace>(() => (folderBacked ? blankWorkspace : loadWorkspace()));
  const [storageIssue, setStorageIssue] = useState(() => folderBacked ? null : getStorageIssue());
  const [recoveryRequired, setRecoveryRequired] = useState(() => !folderBacked && Boolean(getStorageIssue()));
  const [recoveryDownload, setRecoveryDownload] = useState<string | null>(null);
  const [recoveryDownloadConfirmed, setRecoveryDownloadConfirmed] = useState(false);
  const [folder, setFolder] = useState<{ ready: boolean; dir?: string; name?: string; error?: string }>({ ready: !folderBacked });
  const rev = useRef("");
  const inFlight = useRef(0);
  const sendQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [onboarding, setOnboarding] = useState<OnboardingState>(() => (folderBacked ? { completed: true, mode: "existing" } : loadOnboardingState(hasStoredWorkspace())));
  const [onboardingOpen, setOnboardingOpen] = useState(() => !folderBacked && !loadOnboardingState(hasStoredWorkspace()).completed);
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


  useEffect(() => {
    if (!folderBacked) setStorageIssue(saveWorkspace(workspace));
  }, [workspace]);

  /* ---- workspace folder: load, stay in sync with what agents write ---- */
  const pendingSeen = useRef(0);
  function adopt(state: FolderState) {
    rev.current = state.rev;
    setWorkspace(state.workspace);
    setSelectedAccountId((id) => (state.workspace.accounts.some((a) => a.id === id) ? id : state.workspace.accounts[0]?.id ?? ""));
    const waiting = pendingProposals(state.workspace);
    if (waiting.length > pendingSeen.current) {
      const fresh = waiting.length - pendingSeen.current;
      toast({ title: `${waiting[0].actor.name} proposed ${fresh === 1 ? "a change" : `${fresh} changes`} · open Review to decide`, tone: "agent" });
    }
    pendingSeen.current = waiting.length;
  }
  useEffect(() => {
    if (!folderBacked) return;
    let live = true;
    const refresh = () =>
      loadFolder()
        .then((state) => {
          if (!live || inFlight.current > 0) return;
          const first = rev.current === "";
          if (first) pendingSeen.current = pendingProposals(state.workspace).length;
          adopt(state);
          setFolder(f => ({ ...f, error: undefined }));
          if (first) {
            setFolder({ ready: true, dir: state.dir, name: state.folder });
            setOnboardingOpen(state.workspace.accounts.length === 0);
          }
        })
        .catch((error: Error) => live && setFolder(f => ({ ...f, error: error.message })));
    void refresh();
    const stop = watchFolder(() => void refresh(), {
      onError: error => live && setFolder(f => ({ ...f, error: error.message })),
    });
    return () => {
      live = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Send to the folder in order; show the server's records once the queue drains. */
  function send(request: () => Promise<FolderState>) {
    inFlight.current += 1;
    sendQueue.current = sendQueue.current
      .then(request)
      .then((state) => {
        inFlight.current -= 1;
        if (inFlight.current === 0) adopt(state);
      })
      .catch((error: Error) => {
        inFlight.current -= 1;
        toast({ title: error.message, tone: "destructive" });
        if (error instanceof BackendError && error.state) adopt(error.state);
        else void loadFolder().then(adopt).catch(() => undefined);
      });
  }

  /** The one write path for CRM records, shared with the crm command and MCP. */
  function dispatch(op: Op): Change | null {
    const change = newChange(op);
    try {
      setWorkspace(submitChange(workspace, change).workspace);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "That change could not be applied.", tone: "destructive" });
      return null;
    }
    if (folderBacked) send(() => sendChange(change));
    return change;
  }

  /** Everything that is not a record operation: setup, import, settings, the Improve corner. */
  function replaceWorkspace(next: Workspace) {
    const baseRev = rev.current;
    setWorkspace(next);
    if (folderBacked) send(() => replaceFolderWorkspace(next, baseRev));
  }
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);
  useEffect(() => {
    const surface = recoveryRequired ? "Recover" : onboardingOpen ? "Set up" : viewTitles[view];
    document.title = `${surface} · ${brand.name}`;
  }, [onboardingOpen, recoveryRequired, view]);
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
  const notesById = useMemo(() => new Map(workspace.notes.map((n) => [n.id, n])), [workspace.notes]);
  const groundsById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of workspace.claims ?? []) if (c.status === "active") for (const id of c.evidence) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const t of workspace.tasks) for (const id of t.evidence ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  }, [workspace.claims, workspace.tasks]);
  const selectedAccount = accountsById.get(selectedAccountId) ?? workspace.accounts[0];
  const selectedMemory = useMemo(() => (selectedAccount ? accountMemory(workspace, selectedAccount.id) : null), [workspace, selectedAccount]);
  const [traceId, setTraceId] = useState<string | null>(null);
  const traceData = useMemo(() => (traceId ? traceRecord(workspace, traceId) : null), [workspace, traceId]);
  const closeTrace = useCallback(() => setTraceId(null), []);

  const counts = useMemo(
    () => ({
      pipeline: workspace.deals.filter((d) => isOpenDeal(d.stage) && !accountsById.get(d.accountId)?.archivedAt).length,
      accounts: workspace.accounts.length,
      contacts: workspace.accounts.reduce((s, a) => s + a.contacts.length, 0),
      tasks: workspace.tasks.filter((t) => t.status === "open" && !accountsById.get(t.accountId ?? "")?.archivedAt).length,
      notes: workspace.notes.length,
      review: pendingProposals(workspace).length,
    }),
    [workspace],
  );

  const homeMetrics = useMemo(() => {
    const now = Date.now();
    const weightedPipeline = workspace.deals
      .filter((d) => isOpenDeal(d.stage) && !accountsById.get(d.accountId)?.archivedAt)
      .reduce((s, d) => s + (d.value * d.probability) / 100, 0);
    const openTasks = workspace.tasks.filter((t) => t.status === "open" && !accountsById.get(t.accountId ?? "")?.archivedAt);
    return {
      weightedPipeline,
      openDeals: counts.pipeline,
      openTasks: openTasks.length,
      dueSoon: openTasks.filter((t) => {
        const diff = new Date(t.due).getTime() - now;
        return diff >= 0 && diff < 3 * DAY;
      }).length,
      atRisk: workspace.accounts.filter((a) => a.stage === "at_risk" && !a.archivedAt).length,
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

  function completeOnboarding(mode: OnboardingMode) {
    // A folder carries its own state; the browser's memory is per port, not per folder.
    setOnboarding(folderBacked ? { completed: true, mode } : saveOnboardingState(mode));
    setOnboardingOpen(false);
    setView("home");
  }

  function useDemoWorkspace() {
    const demo = normalizeWorkspace(createDemoWorkspace());
    if (!folderBacked && getStorageIssue()) {
      toast({ title: "Recover the saved workspace with a valid import before starting a demo.", tone: "destructive" });
      return;
    }
    replaceWorkspace(demo);
    setSelectedAccountId(demo.accounts[0]?.id ?? "");
    completeOnboarding("demo");
    toast({ title: "Demo workspace ready · all records are synthetic", tone: "accent" });
  }

  function createPersonalWorkspace(draft: WorkspaceSetupDraft) {
    if (!folderBacked && getStorageIssue()) {
      toast({ title: "Recover the saved workspace with a valid import before creating a new workspace.", tone: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    const accountId = makeId("acct");
    const accountName = draft.accountName.trim();
    const contactName = draft.contactName.trim();
    const contactRole = draft.contactRole.trim();
    const owner = draft.owner.trim() || "Unassigned";
    const domain =
      draft.domain.trim() ||
      `${accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account"}.example`;
    const personal: Workspace = {
      name: draft.workspaceName.trim(),
      edition: "Self-Hosted",
      updatedAt: now,
      accounts: [
        {
          id: accountId,
          name: accountName,
          domain,
          segment: draft.segment.trim() || "New relationship",
          stage: "researching",
          priority: "medium",
          arr: 0,
          health: null,
          fit: null,
          sourceConfidence: null,
          owner,
          tags: ["new account"],
          contacts:
            contactName && contactRole
              ? [{ id: makeId("contact"), name: contactName, role: contactRole, influence: "champion", lastSeen: null }]
              : [],
          needs: ["Capture the first source-backed need"],
          risks: ["No source note captured yet"],
          lastTouch: null,
          createdAt: now,
        },
      ],
      deals: [],
      tasks: [],
      notes: [],
      ideas: structuredClone(seedWorkspace.ideas),
      changelog: structuredClone(seedWorkspace.changelog),
    };
    replaceWorkspace(normalizeWorkspace(personal));
    setSelectedAccountId(accountId);
    completeOnboarding("workspace");
    toast({ title: `Workspace created · ${accountName}`, tone: "success" });
  }
  function toggleBuildroom() {
    const next = !buildroom;
    setBuildroom(next);
    toast(
      next
        ? { title: "Share-safe view — private fields are hidden and agent/data-copy actions are paused.", tone: "accent", icon: Eye }
        : { title: "Private view — full account detail is visible.", tone: "neutral", icon: Lock },
    );
  }

  /* ---- CRM mutations ---- */
  function toggleTask(id: string) {
    const task = workspace.tasks.find((t) => t.id === id);
    if (!task) return;
    const done = task.status === "open" || task.status === "waiting";
    if (dispatch({ type: "task.set_status", taskId: id, status: done ? "done" : "open" }) && done) toast({ title: `Done · ${task.title}`, tone: "success" });
  }

  function addTask(draft: TaskDraft) {
    if (!draft.title.trim()) return false;
    const added = dispatch({
      type: "task.add",
      title: draft.title,
      accountId: draft.accountId || undefined,
      due: draft.due || undefined,
      owner: draft.owner || undefined,
      priority: draft.priority,
    });
    if (added) toast({ title: "Task added", tone: "signal" });
    return Boolean(added);
  }

  function addNote(draft: NoteDraft) {
    if (!draft.title.trim() || !draft.body.trim()) return false;
    const added = dispatch({
      type: "note.add",
      accountId: draft.accountId,
      contactId: draft.contactId || undefined,
      source: draft.source,
      title: draft.title,
      body: draft.body,
      sourceRef: draft.sourceRef,
      occurredAt: draft.occurredAt || undefined,
      interaction: draft.interaction === true,
    });
    if (added) toast({ title: "Note captured", tone: "signal" });
    return Boolean(added);
  }

  function addDeal(draft: DealDraft) {
    if (!draft.name.trim() || !draft.accountId) return false;
    const added = dispatch({
      type: "deal.add",
      accountId: draft.accountId,
      name: draft.name,
      stage: draft.stage,
      value: Number(draft.value) || 0,
      owner: draft.owner || undefined,
      closeDate: draft.closeDate || undefined,
    });
    if (added) toast({ title: `Deal added · ${draft.name.trim()}`, tone: "account" });
    return Boolean(added);
  }

  function advanceDeal(id: string) {
    const deal = workspace.deals.find((d) => d.id === id);
    if (!deal) return;
    const i = pipelineColumns.indexOf(deal.stage);
    if (i < 0 || i >= pipelineColumns.length - 1) return;
    const next = pipelineColumns[i + 1];
    if (dispatch({ type: "deal.move", dealId: id, stage: next })) toast({ title: `${deal.name} → ${next}`, tone: next === "won" ? "success" : "account" });
  }

  function loseDeal(id: string) {
    const deal = workspace.deals.find((d) => d.id === id);
    if (!deal) return;
    if (dispatch({ type: "deal.move", dealId: id, stage: "lost" })) toast({ title: `${deal.name} marked lost`, tone: "neutral" });
  }

  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftAccount.name.trim();
    if (!name) return;
    const contactName = draftAccount.contactName.trim();
    const contactRole = draftAccount.contactRole.trim();
    const added = dispatch({
      type: "account.add",
      name,
      domain: draftAccount.domain,
      segment: draftAccount.segment,
      owner: draftAccount.owner,
      stage: draftAccount.stage,
      priority: draftAccount.priority,
      contact: contactName && contactRole ? { name: contactName, role: contactRole } : undefined,
    });
    if (!added) return;
    setSelectedAccountId(added.recordId);
    setDraftAccount(emptyAccountDraft);
    setAi(emptyAi);
    toast({ title: `Account added · ${name}`, tone: "success" });
  }

  function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftContact.name.trim();
    const role = draftContact.role.trim();
    if (!selectedAccount || !name || !role) return;
    const added = dispatch({ type: "contact.add", accountId: selectedAccount.id, name, role, influence: draftContact.influence, email: draftContact.email });
    if (!added) return;
    setDraftContact(emptyContactDraft);
    toast({ title: `Contact added · ${name}`, tone: "account" });
  }

  /* ---- Review: what agents proposed ---- */
  function decideProposals(ids: string[], decision: "approve" | "reject") {
    let next = workspace;
    const decided: string[] = [];
    try {
      for (const id of ids) {
        next = resolveProposal(next, id, decision, "you").workspace;
        decided.push(id);
      }
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "That proposal could not be applied.", tone: "destructive" });
    }
    if (decided.length === 0) return;
    setWorkspace(next);
    pendingSeen.current = pendingProposals(next).length;
    if (folderBacked) for (const id of decided) send(() => sendDecision(id, decision));
    const first = (workspace.proposals ?? []).find((p) => p.id === decided[0]);
    toast(
      decision === "reject"
        ? { title: decided.length === 1 ? "Proposal rejected" : `${decided.length} proposals rejected`, tone: "neutral" }
        : { title: decided.length === 1 ? `Approved · ${first?.summary ?? ""}` : `Approved ${decided.length} changes`, tone: "success" },
    );
  }
  function setAgentMode(mode: AgentMode) {
    replaceWorkspace(touchWorkspace({ ...workspace, agentMode: mode }));
    toast({ title: mode === "review" ? "Agent changes now wait for your review." : "Agent changes now apply directly and are logged.", tone: "agent" });
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
      setSyncBusy(true);
      const count = await writeVault(handle, buildVaultFiles(workspace));
      const next = {
        ...syncSettings,
        vaultName: handle.name,
        lastSyncedAt: new Date().toISOString(),
        fileCount: count,
      };
      setSyncSettings(next);
      saveSyncSettings(next);
      toast({ title: `Agent workspace ready · ${count} files in ${handle.name}`, tone: "success" });
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast({ title: err.message || "Couldn't create the agent workspace.", tone: "destructive" });
      }
    } finally {
      setSyncBusy(false);
    }
  }
  async function syncNow() {
    if (!vaultHandle.current) {
      await connectVault();
      return;
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
  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: label, tone: "agent" });
    } catch {
      toast({ title: "Couldn't copy to the clipboard.", tone: "destructive" });
    }
  }
  async function copyWorkspaceAgentPrompt() {
    try {
      await navigator.clipboard.writeText(buildWorkspaceAgentStarterPrompt());
      toast({ title: "Starter request copied · open it in your synced folder", tone: "agent" });
    } catch {
      toast({ title: "Couldn't copy the starter request.", tone: "destructive" });
    }
  }
  async function copyAccountMarkdown() {
    if (!selectedAccount) return;
    const md = accountToMarkdown(
      selectedAccount,
      workspace.deals.filter((d) => d.accountId === selectedAccount.id),
      workspace.tasks.filter((t) => t.accountId === selectedAccount.id),
      workspace.notes.filter((n) => n.accountId === selectedAccount.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      (workspace.claims ?? []).filter((c) => c.accountId === selectedAccount.id),
    );
    try {
      await navigator.clipboard.writeText(md);
      toast({ title: "Account copied as Markdown", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy to clipboard.", tone: "destructive" });
    }
  }
  async function copyAgentHandoff() {
    if (!selectedAccount) return;
    const text = buildAccountAgentHandoff({
      account: selectedAccount,
      deals: workspace.deals.filter((deal) => deal.accountId === selectedAccount.id),
      tasks: workspace.tasks.filter((task) => task.accountId === selectedAccount.id),
      notes: workspace.notes.filter((note) => note.accountId === selectedAccount.id),
    });
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Agent handoff copied · review the task before running it", tone: "agent" });
    } catch {
      toast({ title: "Couldn't copy the agent handoff.", tone: "destructive" });
    }
  }
  function exportTasksICS(taskIds: string[]) {
    const selected = new Set(taskIds);
    const open = workspace.tasks.filter((t) => t.status === "open" && selected.has(t.id) && !accountsById.get(t.accountId ?? "")?.archivedAt);
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
  function downloadStoredOriginal() {
    try {
      const raw = getStoredWorkspaceText();
      if (raw === null) return;
      const url = URL.createObjectURL(new Blob([raw], {type: "application/json"}));
      const link = document.createElement("a");
      link.href = url; link.download = "open-crm-original-recovery.json";
      link.click(); URL.revokeObjectURL(url);
      setRecoveryDownload(raw);
      setRecoveryDownloadConfirmed(false);
    } catch (error) { toast({ title: String(error), tone: "destructive" }); }
  }
  async function importWorkspace(file: File, onboardingImport = false) {
    const { workspace: parsed, errors } = parseWorkspace(await file.text());
    if (!parsed) {
      toast({ title: `That file isn't a valid ${brand.name} workspace. ${errors[0] ?? ""}`.trim(), tone: "destructive" });
      return;
    }
    if (!folderBacked) {
      const { error } = recoverWorkspace(parsed, recoveryDownloadConfirmed && recoveryDownload !== null ? { downloadedOriginal: recoveryDownload } : {});
      setStorageIssue(error);
      if (error) return;
      setRecoveryRequired(false);
      setRecoveryDownload(null);
      setRecoveryDownloadConfirmed(false);
    }
    replaceWorkspace(touchWorkspace(parsed));
    setSelectedAccountId(parsed.accounts[0]?.id ?? "");
    if (onboardingImport) completeOnboarding("import");
    toast({ title: "Workspace imported", tone: "success" });
  }
  function handleReset() {
    const reset = createDemoWorkspace();
    if (!folderBacked) {
      const { error } = recoverWorkspace(reset, recoveryDownloadConfirmed && recoveryDownload !== null ? { downloadedOriginal: recoveryDownload } : {});
      setStorageIssue(error);
      if (error) return;
    }
    replaceWorkspace(reset);
    setSelectedAccountId(reset.accounts[0]?.id ?? "");
    setAi(emptyAi);
    setOnboarding(saveOnboardingState("demo"));
    toast({ title: "Workspace reset to the demo", tone: "warning" });
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
    : id === "review" ? counts.review || undefined
    : undefined;

  const recoveryConfirmation = recoveryDownload !== null && <label className="flex items-start gap-2 text-body-sm"><input type="checkbox" checked={recoveryDownloadConfirmed} onChange={event => setRecoveryDownloadConfirmed(event.target.checked)} />I have saved the original download. Use it as my recovery backup if browser storage is full.</label>;

  if (folderBacked && !folder.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        {folder.error ? (
          <div className="max-w-xl space-y-2">
            <h1 className="font-serif text-h2 text-foreground">This workspace folder could not be opened</h1>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface-sunken p-3 font-mono text-[12px] leading-5 text-muted-foreground">{folder.error}</pre>
            <p className="text-body-sm text-muted-foreground">Fix the file, or restore it from a backup, then reload. <code className="font-mono">./crm check</code> lists every problem.</p>
          </div>
        ) : (
          <p className="text-body-sm text-muted-foreground">Opening your workspace…</p>
        )}
      </div>
    );
  }

  if (recoveryRequired) {
    return <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="max-w-xl space-y-4 rounded-xl border border-border bg-surface p-6">
        <h1 className="font-serif text-h1">Recover your saved workspace</h1>
        <p role="alert" className="text-body-sm text-destructive">{storageIssue}</p>
        <p className="text-body-sm text-muted-foreground">No demo or new records have replaced your data. Download the stored original for inspection, or import a valid Open CRM backup. Import preserves the original before replacement.</p>
        <Button onClick={downloadStoredOriginal}>Download stored original</Button>
        {recoveryConfirmation}
        <label className="block text-body-sm">Import a valid backup
          <input className="mt-2 block w-full text-body-sm" type="file" accept="application/json" onChange={event => { const file = event.target.files?.[0]; if (file) void importWorkspace(file, true); }} />
        </label>
      </section>
    </main>;
  }

  if (onboardingOpen) {
    return (
      <>
      {storageIssue && <div role="alert" className="border-b border-warning bg-surface p-4 text-body-sm">{storageIssue} Import a valid backup below to recover. The original is retained before replacement.</div>}
      <OnboardingView
        onCreateWorkspace={createPersonalWorkspace}
        onImport={(file) => void importWorkspace(file, true)}
        onUseDemo={useDemoWorkspace}
        onClose={onboarding.completed && workspace.accounts.length > 0 ? () => setOnboardingOpen(false) : undefined}
        folderBacked={folderBacked}
        workspaceName={folderBacked ? workspace.name : undefined}
      />
      </>
    );
  }

  return (
    <PrivacyProvider buildroom={buildroom}>
      <div className="app-grid bg-background">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface/60 px-3.5 py-5 lg:flex">
          <div className="mb-7 flex items-center gap-2.5 px-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layers3 className="h-[18px] w-[18px]" />
            </span>
            <div className="font-serif text-[15px] font-medium text-foreground">{brand.name}</div>
          </div>

          <nav aria-label="Primary" className="space-y-0.5">
            {primaryNav.map((item) => (
              <NavItem key={item.id} icon={item.icon} label={item.label} active={view === item.id} count={countFor(item.id)} attention={item.id === "review"} onClick={() => navigate(item.id)} />
            ))}
          </nav>

          <div className="my-3 border-t border-border" />

          <nav aria-label="Workspace" className="space-y-0.5">
            {secondaryNav.map((item) => (
              <NavItem key={item.id} icon={item.icon} label={item.label} active={view === item.id} onClick={() => navigate(item.id)} />
            ))}
          </nav>

          <div className="mt-auto space-y-3">
            <details className="px-2 text-body-sm text-muted-foreground">
              <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:focus-ring">{folderBacked ? "Saved to this computer" : "Saved in this browser"}</summary>
              <p className="mt-2 leading-relaxed">
                {folderBacked
                  ? "Records are stored in your workspace folder. Connected agents use the providers you choose."
                  : "Export a backup in Settings. AI requests go to your chosen provider when you use AI features."}
              </p>
            </details>
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
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-body font-medium text-foreground">{workspace.name}</div>
                  </div>
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
                    {item.id === "review" && counts.review > 0 && (
                      <span className="rounded-full bg-agent-bg px-1.5 py-px font-mono text-[11px] tabular-nums text-agent-fg">{counts.review}</span>
                    )}
                    <span className={cn("absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-accent transition-opacity", active ? "opacity-100" : "opacity-0")} aria-hidden />
                  </button>
                );
              })}
            </nav>
          </header>
          {folderBacked && folder.ready && folder.error && <div role="alert" className="m-4 rounded-lg border border-warning p-3 text-body-sm">Records may be stale: {folder.error} Keep the workspace server running; changes will refresh after reconnection.</div>}
          {storageIssue && <div role="alert" className="m-4 space-y-2 rounded-lg border border-warning p-3 text-body-sm"><p>{storageIssue}</p><Button size="sm" onClick={exportWorkspace}>Export unsaved work</Button><Button size="sm" onClick={downloadStoredOriginal}>Download stored original</Button>{recoveryConfirmation}</div>}

          <div
            className={cn(
              "mx-auto max-w-7xl px-4 py-6 transition-[opacity,transform] duration-base ease-out lg:px-6 motion-reduce:transition-none",
              entering ? "translate-y-1.5 opacity-0" : "translate-y-0 opacity-100",
            )}
          >
            <div data-view="home" className={cn(view !== "home" && "hidden")}>
              <HomeView
                workspace={workspace}
                accountsById={accountsById}
                metrics={homeMetrics}
                onboardingMode={onboarding.mode}
                onOpenOnboarding={() => setOnboardingOpen(true)}
                onNavigate={navigate}
                onSelectAccount={selectAccountAndOpen}
                onToggleTask={toggleTask}
                onTrace={setTraceId}
              />
            </div>
            <div data-view="book" className={cn(view !== "book" && "hidden")}>
              <BookView workspace={workspace} onSelectAccount={selectAccountAndOpen} />
            </div>
            <div data-view="pipeline" className={cn(view !== "pipeline" && "hidden")}>
              <PipelineView deals={workspace.deals.filter(d => !accountsById.get(d.accountId)?.archivedAt)} accounts={workspace.accounts.filter(a => !a.archivedAt)} accountsById={accountsById} onAdvanceDeal={advanceDeal} onLoseDeal={loseDeal} onSelectAccount={selectAccountAndOpen} onAddDeal={addDeal} />
            </div>
            <div data-view="accounts" className={cn(view !== "accounts" && "hidden")}>
              <AccountsView
                memory={selectedMemory}
                onAddClaim={(op) => {
                  const added = dispatch(op);
                  if (added) toast({ title: op.evidence?.length ? "Recorded, with its evidence" : "Recorded as a hunch · cite a note when you have one", tone: "signal" });
                  return Boolean(added);
                }}
                onResolveClaim={(claimId, reason) => {
                  const done = dispatch({ type: "claim.resolve", claimId, reason });
                  if (done) toast({ title: "Resolved · kept in the account's history", tone: "neutral" });
                  return Boolean(done);
                }}
                onTrace={setTraceId}
                onCopyBrief={() => selectedMemory && void copyText(briefMarkdown(selectedMemory), "Brief copied · paste it anywhere")}
                onUpdateAccount={(accountId, patch) => Boolean(dispatch({ type: "account.update", accountId, patch }))}
                onArchiveAccount={(accountId, archived, reason) => Boolean(dispatch({ type: "account.archive", accountId, archived, reason }))}
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
                onCopyAgentHandoff={copyAgentHandoff}
                onOpenSettings={() => navigate("settings")}
              />
            </div>
            <div data-view="contacts" className={cn(view !== "contacts" && "hidden")}>
              <ContactsView accounts={workspace.accounts} onSelectAccount={selectAccountAndOpen} onTrace={setTraceId} />
            </div>
            <div data-view="tasks" className={cn(view !== "tasks" && "hidden")}>
              <TasksView tasks={workspace.tasks} accounts={workspace.accounts} accountsById={accountsById} notesById={notesById} onToggleTask={toggleTask} onAddTask={addTask} onUpdateTask={(taskId, patch) => Boolean(dispatch({ type: "task.update", taskId, patch }))} onSelectAccount={selectAccountAndOpen} onExportICS={exportTasksICS} onTrace={setTraceId} />
            </div>
            <div data-view="notes" className={cn(view !== "notes" && "hidden")}>
              <NotesView notes={workspace.notes} accounts={workspace.accounts} accountsById={accountsById} onAddNote={addNote} groundsById={groundsById} onTrace={setTraceId} />
            </div>
            <div data-view="review" className={cn(view !== "review" && "hidden")}>
              <ReviewView
                workspace={workspace}
                accountsById={accountsById}
                folder={folderBacked ? { dir: folder.dir, name: folder.name } : null}
                onDecide={decideProposals}
                onSetMode={setAgentMode}
                onSelectAccount={selectAccountAndOpen}
                onCopy={copyText}
              />
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
                agentPrompt={buildWorkspaceAgentStarterPrompt()}
                onCopyAgentPrompt={copyWorkspaceAgentPrompt}
                onExport={exportWorkspace}
                onImport={importWorkspace}
                onReset={handleReset}
                onOpenOnboarding={() => setOnboardingOpen(true)}
                folder={folderBacked ? { dir: folder.dir } : null}
                onOpenReview={() => navigate("review")}
              />
            </div>
            <div data-view="improve" className={cn(view !== "improve" && "hidden")}>
              <ImproveView ideas={workspace.ideas} />
            </div>
          </div>
        </main>
      </div>

      <TraceSheet trace={traceData} onClose={closeTrace} onNavigate={setTraceId} />

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
