import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  ClipboardCheck,
  Database,
  FileDown,
  GitBranch,
  Home,
  Inbox,
  Layers3,
  Lightbulb,
  Lock,
  MessageSquarePlus,
  Moon,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import {
  loadWorkspace,
  resetWorkspace,
  saveWorkspace,
  touchWorkspace,
} from "./lib/storage";
import { cn, formatCurrency, formatDate, makeId } from "./lib/utils";
import type {
  Account,
  AccountStage,
  CodexTask,
  Contact,
  Idea,
  Priority,
  Signal,
  SignalSource,
  Workspace,
} from "./types";

type View =
  | "today"
  | "accounts"
  | "signals"
  | "feedback"
  | "loop"
  | "codex"
  | "settings";
type FeedbackMode = "private_signal" | "buildroom_request" | "github_issue";

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "today", label: "Today", icon: Home },
  { id: "accounts", label: "Accounts", icon: Users },
  { id: "signals", label: "Signals", icon: Inbox },
  { id: "feedback", label: "Tell Open CRM", icon: MessageSquarePlus },
  { id: "loop", label: "Open CRM Loop", icon: GitBranch },
  { id: "codex", label: "Codex", icon: Bot },
  { id: "settings", label: "Settings", icon: Settings },
];

const sourceOptions: SignalSource[] = [
  "call",
  "email",
  "support",
  "community",
  "feedback",
  "review",
  "github",
  "usage",
  "market",
];

const priorityTone: Record<Priority, "muted" | "warning" | "destructive"> = {
  low: "muted",
  medium: "muted",
  high: "warning",
  urgent: "destructive",
};

const feedbackModes: Record<
  FeedbackMode,
  {
    label: string;
    summary: string;
    sourceRef: string;
    createsIdea: boolean;
    publicSurface: string;
  }
> = {
  private_signal: {
    label: "Private signal",
    summary: "Capture context for Zentrik without publishing anything.",
    sourceRef: "In-app feedback · private",
    createsIdea: false,
    publicSurface: "Private Zentrik workspace only",
  },
  buildroom_request: {
    label: "Buildroom request",
    summary: "Create a public-safe idea candidate and initial vote.",
    sourceRef: "Open CRM Buildroom draft · public-safe",
    createsIdea: true,
    publicSurface: "Open CRM Buildroom after moderation",
  },
  github_issue: {
    label: "GitHub issue",
    summary: "Shape a reproducible public issue for open-source work.",
    sourceRef: "GitHub issue draft · public",
    createsIdea: true,
    publicSurface: "GitHub issue plus Zentrik signal",
  },
};

const workflowAreas = [
  "First-run setup",
  "Account memory",
  "Signal capture",
  "Codex tasks",
  "Buildroom loop",
  "Self-hosting",
  "Privacy",
];

const accountStages: AccountStage[] = [
  "researching",
  "active",
  "expanding",
  "renewing",
  "at_risk",
];

const priorities: Priority[] = ["low", "medium", "high", "urgent"];
const contactInfluences: Contact["influence"][] = [
  "economic",
  "champion",
  "technical",
  "user",
];

const emptyAccountDraft = {
  name: "",
  domain: "",
  segment: "",
  owner: "",
  stage: "researching" as AccountStage,
  priority: "medium" as Priority,
  nextAction: "",
  contactName: "",
  contactRole: "",
};

const emptyContactDraft = {
  name: "",
  role: "",
  influence: "champion" as Contact["influence"],
};

function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => loadWorkspace());
  const [view, setView] = useState<View>("today");
  const [query, setQuery] = useState("");
  const [publicMode, setPublicMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(
    workspace.accounts[0]?.id ?? "",
  );
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [copyErrorTaskId, setCopyErrorTaskId] = useState<string | null>(null);
  const [draftAccount, setDraftAccount] = useState(emptyAccountDraft);
  const [draftContact, setDraftContact] = useState(emptyContactDraft);
  const [draftSignal, setDraftSignal] = useState({
    accountId: workspace.accounts[0]?.id ?? "",
    source: "call" as SignalSource,
    title: "",
    body: "",
  });
  const [draftFeedback, setDraftFeedback] = useState({
    mode: "private_signal" as FeedbackMode,
    accountId: workspace.accounts[0]?.id ?? "",
    workflowArea: workflowAreas[0],
    title: "",
    body: "",
  });

  useEffect(() => {
    saveWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);

  const accountsById = useMemo(
    () => new Map(workspace.accounts.map((account) => [account.id, account])),
    [workspace.accounts],
  );

  const selectedAccount =
    accountsById.get(selectedAccountId) ?? workspace.accounts[0];

  const filteredAccounts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return workspace.accounts;
    }

    return workspace.accounts.filter((account) => {
      const haystack = [
        account.name,
        account.domain,
        account.segment,
        account.owner,
        ...account.tags,
        ...account.needs,
        ...account.risks,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, workspace.accounts]);

  const visibleSelectedAccount =
    filteredAccounts.find((account) => account.id === selectedAccount?.id) ??
    filteredAccounts[0];

  const metrics = useMemo(() => {
    const pipeline = workspace.accounts.reduce((sum, account) => sum + account.arr, 0);
    const atRisk = workspace.accounts.filter((account) => account.stage === "at_risk").length;
    const openActions = workspace.accounts.filter(
      (account) => account.nextAction.status === "open",
    ).length;
    const highImpactSignals = workspace.signals.filter(
      (signal) => signal.impact === "high" || signal.impact === "urgent",
    ).length;

    return { pipeline, atRisk, openActions, highImpactSignals };
  }, [workspace.accounts, workspace.signals]);

  function completeNextAction(accountId: string) {
    const account = accountsById.get(accountId);
    if (!account) {
      return;
    }

    setWorkspace((current) => touchWorkspace({
      ...current,
      accounts: current.accounts.map((item) =>
        item.id === accountId
          ? {
              ...item,
              nextAction: { ...item.nextAction, status: "done" },
              lastTouch: new Date().toISOString(),
            }
          : item,
      ),
      evolutionLog: [
        {
          id: makeId("log"),
          date: new Date().toISOString(),
          title: `Completed next action for ${account.name}`,
          summary: account.nextAction.label,
          evidence: ["Human approved account workflow step"],
        },
        ...current.evolutionLog,
      ],
    }));
  }

  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftAccount.name.trim();
    if (!name) {
      return;
    }

    const now = new Date().toISOString();
    const owner = draftAccount.owner.trim() || "Unassigned";
    const accountId = makeId("acct");
    const contactName = draftAccount.contactName.trim();
    const contactRole = draftAccount.contactRole.trim();
    const segment = draftAccount.segment.trim() || "New relationship";
    const domain =
      draftAccount.domain.trim() ||
      `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account"}.example`;
    const nextAction =
      draftAccount.nextAction.trim() || "Capture the first signal and define the account plan";
    const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const account: Account = {
      id: accountId,
      name,
      domain,
      segment,
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
          ? [
              {
                id: makeId("contact"),
                name: contactName,
                role: contactRole,
                influence: "champion",
                lastSeen: now,
              },
            ]
          : [],
      needs: ["Needs discovery"],
      risks: ["No recent signal captured yet"],
      nextAction: {
        id: makeId("act"),
        label: nextAction,
        due,
        owner,
        status: "open",
      },
      lastTouch: now,
    };

    setWorkspace((current) => touchWorkspace({
      ...current,
      accounts: [account, ...current.accounts],
      evolutionLog: [
        {
          id: makeId("log"),
          date: now,
          title: `New account created: ${name}`,
          summary:
            "A local account record was created with a first next action and optional primary contact.",
          evidence: ["Manual local account setup"],
        },
        ...current.evolutionLog,
      ],
    }));
    setSelectedAccountId(accountId);
    setDraftAccount(emptyAccountDraft);
    setDraftSignal((current) => ({ ...current, accountId }));
    setDraftFeedback((current) => ({ ...current, accountId }));
  }

  function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accountId = selectedAccount?.id;
    const name = draftContact.name.trim();
    const role = draftContact.role.trim();
    if (!accountId || !name || !role || !selectedAccount) {
      return;
    }

    const now = new Date().toISOString();
    const contact: Contact = {
      id: makeId("contact"),
      name,
      role,
      influence: draftContact.influence,
      lastSeen: now,
    };

    setWorkspace((current) => touchWorkspace({
      ...current,
      accounts: current.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              contacts: [...account.contacts, contact],
              lastTouch: now,
            }
          : account,
      ),
      evolutionLog: [
        {
          id: makeId("log"),
          date: now,
          title: `Contact added: ${name}`,
          summary: `${role} was added to ${selectedAccount.name}.`,
          evidence: ["Manual local contact setup"],
        },
        ...current.evolutionLog,
      ],
    }));
    setDraftContact(emptyContactDraft);
  }

  function approveIdea(ideaId: string) {
    setWorkspace((current) => touchWorkspace({
      ...current,
      ideas: current.ideas.map((idea) =>
        idea.id === ideaId
          ? {
              ...idea,
              status: idea.status === "candidate" ? "shaping" : "queued",
              votes: idea.votes + 1,
              confidence: Math.min(99, idea.confidence + 3),
            }
          : idea,
      ),
      evolutionLog: [
        {
          id: makeId("log"),
          date: new Date().toISOString(),
          title: "Idea advanced from workspace review",
          summary:
            "A human moved an idea forward after reviewing linked signals and source confidence.",
          evidence: [`Idea ${ideaId}`],
        },
        ...current.evolutionLog,
      ],
    }));
  }

  function addSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftSignal.title.trim() || !draftSignal.body.trim()) {
      return;
    }

    const signal: Signal = {
      id: makeId("sig"),
      accountId: draftSignal.accountId,
      source: draftSignal.source,
      title: draftSignal.title.trim(),
      body: draftSignal.body.trim(),
      sentiment: "neutral",
      impact: "medium",
      receivedAt: new Date().toISOString(),
      sourceRef: "Manual local intake",
    };

    setWorkspace((current) => touchWorkspace({
      ...current,
      signals: [signal, ...current.signals],
      evolutionLog: [
        {
          id: makeId("log"),
          date: signal.receivedAt,
          title: "New signal captured",
          summary: signal.title,
          evidence: [signal.sourceRef],
        },
        ...current.evolutionLog,
      ],
    }));
    setDraftSignal((current) => ({ ...current, title: "", body: "" }));
  }

  function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draftFeedback.title.trim();
    const body = draftFeedback.body.trim();
    if (!title || !body) {
      return;
    }

    const mode = feedbackModes[draftFeedback.mode];
    const receivedAt = new Date().toISOString();
    const signalId = makeId("sig");
    const ideaId = mode.createsIdea ? makeId("idea") : undefined;
    const taskId = mode.createsIdea ? makeId("task") : undefined;
    const bodyWithContext = [
      `Workflow area: ${draftFeedback.workflowArea}`,
      `Mode: ${mode.label}`,
      "",
      body,
    ].join("\n");

    const signal: Signal = {
      id: signalId,
      accountId: draftFeedback.accountId,
      source: draftFeedback.mode === "github_issue" ? "github" : "feedback",
      title,
      body: bodyWithContext,
      sentiment: "mixed",
      impact:
        draftFeedback.mode === "private_signal"
          ? "medium"
          : draftFeedback.mode === "github_issue"
            ? "high"
            : "medium",
      receivedAt,
      sourceRef: mode.sourceRef,
      linkedIdeaId: ideaId,
    };

    const idea: Idea | null = ideaId
      ? {
          id: ideaId,
          title,
          problem: `${draftFeedback.workflowArea}: ${body}`,
          status: "candidate",
          votes: draftFeedback.mode === "buildroom_request" ? 1 : 0,
          linkedSignalIds: [signalId],
          targetRelease: "triage",
          confidence: draftFeedback.mode === "buildroom_request" ? 64 : 58,
        }
      : null;

    const task: CodexTask | null =
      taskId && ideaId
        ? {
            id: taskId,
            title: `Triage feedback: ${title}`,
            status: "ready",
            accountId: draftFeedback.accountId,
            ideaId,
            prompt: [
              `Evaluate this ${mode.label.toLowerCase()} for Zentrik Open CRM.`,
              `Workflow area: ${draftFeedback.workflowArea}.`,
              "Decide whether it should remain a signal, merge into an existing idea, or become implementation work.",
              "Return a public-safe summary, likely affected workflow, acceptance criteria, and validation plan.",
            ].join(" "),
            guardrail:
              "Do not expose private account records. Convert raw local context into a public-safe product summary before Buildroom or GitHub publication.",
          }
        : null;

    setWorkspace((current) => touchWorkspace({
      ...current,
      signals: [signal, ...current.signals],
      ideas: idea ? [idea, ...current.ideas] : current.ideas,
      codexTasks: task ? [task, ...current.codexTasks] : current.codexTasks,
      evolutionLog: [
        {
          id: makeId("log"),
          date: receivedAt,
          title: idea ? "Feedback became an idea candidate" : "Feedback captured as signal",
          summary: idea
            ? `${mode.label} created a Zentrik signal, idea candidate, and Codex triage task.`
            : `${mode.label} created a private Zentrik signal for future synthesis.`,
          evidence: [
            mode.sourceRef,
            draftFeedback.workflowArea,
            mode.publicSurface,
          ],
        },
        ...current.evolutionLog,
      ],
    }));

    setDraftFeedback((current) => ({ ...current, title: "", body: "" }));
    setView(mode.createsIdea ? "loop" : "signals");
  }

  async function copyCodexPrompt(task: CodexTask) {
    const account = task.accountId ? accountsById.get(task.accountId) : undefined;
    const idea = task.ideaId
      ? workspace.ideas.find((item) => item.id === task.ideaId)
      : undefined;
    const prompt = [
      `Workspace: ${workspace.name}`,
      account
        ? `Account: ${account.name} (${
            publicMode ? "domain hidden in Buildroom mode" : account.domain
          })`
        : null,
      idea ? `Idea: ${idea.title}` : null,
      "",
      task.prompt,
      "",
      `Guardrail: ${task.guardrail}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(prompt);
      setCopiedTaskId(task.id);
      setCopyErrorTaskId(null);
      window.setTimeout(() => setCopiedTaskId(null), 1600);
    } catch {
      setCopiedTaskId(null);
      setCopyErrorTaskId(task.id);
      window.setTimeout(() => setCopyErrorTaskId(null), 2400);
    }
  }

  function exportWorkspace() {
    const payload = JSON.stringify(workspace, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zentrik-open-crm-workspace.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    const reset = resetWorkspace();
    setWorkspace(reset);
    setSelectedAccountId(reset.accounts[0]?.id ?? "");
    setDraftAccount(emptyAccountDraft);
    setDraftContact(emptyContactDraft);
    setDraftSignal((current) => ({
      ...current,
      accountId: reset.accounts[0]?.id ?? "",
    }));
    setDraftFeedback((current) => ({
      ...current,
      accountId: reset.accounts[0]?.id ?? "",
    }));
  }

  return (
    <div className="app-grid bg-background">
      <aside className="hidden border-r bg-shell px-4 py-5 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Zentrik Open CRM</div>
            <div className="text-xs text-muted-foreground">Local-first workspace</div>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn("nav-item", view === item.id && "nav-item-active")}
                onClick={() => setView(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-8 rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-success" />
            Public-safe demo
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            This workspace uses synthetic records and safe domains. Do not paste
            private customer data into public fixtures.
          </p>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-10 border-b bg-background/94 px-4 py-3 backdrop-blur lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
                <Layers3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold">{workspace.name}</h1>
                <p className="truncate text-xs text-muted-foreground">
                  {workspace.edition} · Updated {formatDate(workspace.updatedAt)}
                </p>
              </div>
            </div>

            <label className="relative hidden min-w-[260px] sm:block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                className="focus-input w-full pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search accounts, risks, needs"
              />
            </label>

            <Button
              size="sm"
              variant={publicMode ? "primary" : "secondary"}
              onClick={() => setPublicMode((value) => !value)}
            >
              <Lock className="h-4 w-4" />
              {publicMode ? "Buildroom" : "Private"}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setDarkMode((value) => !value)}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-medium",
                    view === item.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                  onClick={() => setView(item.id)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
          {view === "today" && (
            <TodayView
              metrics={metrics}
              workspace={workspace}
              accountsById={accountsById}
              publicMode={publicMode}
              onCompleteAction={completeNextAction}
              onNavigate={setView}
              onSelectAccount={(accountId) => {
                setSelectedAccountId(accountId);
                setView("accounts");
              }}
            />
          )}
          {view === "accounts" && (
            <AccountsView
              accounts={filteredAccounts}
              selectedAccount={visibleSelectedAccount}
              publicMode={publicMode}
              signals={workspace.signals}
              draftAccount={draftAccount}
              draftContact={draftContact}
              setDraftAccount={setDraftAccount}
              setDraftContact={setDraftContact}
              onAddAccount={addAccount}
              onAddContact={addContact}
              onSelectAccount={setSelectedAccountId}
              onCompleteAction={completeNextAction}
            />
          )}
          {view === "signals" && (
            <SignalsView
              workspace={workspace}
              accountsById={accountsById}
              draftSignal={draftSignal}
              setDraftSignal={setDraftSignal}
              onSubmit={addSignal}
            />
          )}
          {view === "feedback" && (
            <FeedbackView
              workspace={workspace}
              draftFeedback={draftFeedback}
              setDraftFeedback={setDraftFeedback}
              onSubmit={submitFeedback}
            />
          )}
          {view === "loop" && (
            <LoopView
              workspace={workspace}
              accountsById={accountsById}
              onApproveIdea={approveIdea}
            />
          )}
          {view === "codex" && (
            <CodexView
              workspace={workspace}
              accountsById={accountsById}
              copiedTaskId={copiedTaskId}
              copyErrorTaskId={copyErrorTaskId}
              onCopyPrompt={copyCodexPrompt}
            />
          )}
          {view === "settings" && (
            <SettingsView onExport={exportWorkspace} onReset={handleReset} />
          )}
        </div>
      </main>
    </div>
  );
}

function TodayView({
  metrics,
  workspace,
  accountsById,
  publicMode,
  onCompleteAction,
  onNavigate,
  onSelectAccount,
}: {
  metrics: {
    pipeline: number;
    atRisk: number;
    openActions: number;
    highImpactSignals: number;
  };
  workspace: Workspace;
  accountsById: Map<string, Account>;
  publicMode: boolean;
  onCompleteAction: (accountId: string) => void;
  onNavigate: (view: View) => void;
  onSelectAccount: (accountId: string) => void;
}) {
  const openAccounts = workspace.accounts.filter(
    (account) => account.nextAction.status === "open",
  );
  const recentSignals = workspace.signals.slice(0, 3);

  return (
    <div className="section-grid">
      <FirstUsePanel
        signalCount={workspace.signals.length}
        accountCount={workspace.accounts.length}
        taskCount={workspace.codexTasks.length}
        onNavigate={onNavigate}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Weighted pipeline"
          value={publicMode ? "Hidden" : formatCurrency(metrics.pipeline)}
          icon={Database}
        />
        <MetricCard label="Open next actions" value={metrics.openActions.toString()} icon={ClipboardCheck} />
        <MetricCard label="High-impact signals" value={metrics.highImpactSignals.toString()} icon={Activity} />
        <MetricCard label="At-risk accounts" value={metrics.atRisk.toString()} icon={ShieldCheck} tone="destructive" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daily Account Board</CardTitle>
            <p className="text-sm text-muted-foreground">
              Prioritized from stage, source confidence, signal impact, and due dates.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {openAccounts.map((account) => (
              <div
                key={account.id}
                className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="truncate text-sm font-semibold hover:underline"
                      onClick={() => onSelectAccount(account.id)}
                    >
                      {account.name}
                    </button>
                    <Badge tone={priorityTone[account.priority]}>{account.priority}</Badge>
                    <Badge tone="account">{account.stage.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {account.nextAction.label}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Due {formatDate(account.nextAction.due)}</span>
                    <span>Owner {account.owner}</span>
                    <span>Confidence {account.sourceConfidence}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <Button size="sm" variant="ghost" onClick={() => onSelectAccount(account.id)}>
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => onCompleteAction(account.id)}>
                    <Check className="h-4 w-4" />
                    Done
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fresh Signals</CardTitle>
            <p className="text-sm text-muted-foreground">
              Incoming evidence that should change account work or product direction.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentSignals.map((signal) => {
              const account = accountsById.get(signal.accountId);
              return (
                <SignalRow
                  key={signal.id}
                  signal={signal}
                  accountName={account?.name ?? "Unknown account"}
                />
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FirstUsePanel({
  signalCount,
  accountCount,
  taskCount,
  onNavigate,
}: {
  signalCount: number;
  accountCount: number;
  taskCount: number;
  onNavigate: (view: View) => void;
}) {
  const steps = [
    {
      label: "Review accounts",
      detail: `${accountCount} synthetic accounts are ready for inspection.`,
      icon: Users,
      view: "accounts" as const,
    },
    {
      label: "Capture a signal",
      detail: `${signalCount} signals show how evidence changes the workspace.`,
      icon: MessageSquarePlus,
      view: "signals" as const,
    },
    {
      label: "Submit feedback",
      detail: "Test private, Buildroom, and GitHub-ready feedback modes.",
      icon: Lightbulb,
      view: "feedback" as const,
    },
    {
      label: "Copy a Codex task",
      detail: `${taskCount} guarded prompts are ready for agent-assisted work.`,
      icon: Bot,
      view: "codex" as const,
    },
    {
      label: "Trace the loop",
      detail: "Ideas, releases, and outcome checks explain product evolution.",
      icon: GitBranch,
      view: "loop" as const,
    },
  ];

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-signal" />
            Start with source-grounded account work
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Open CRM is useful before connectors. Inspect the demo workspace,
            add one real signal, review the account memory it creates, then let
            an agent prepare work from explicit context.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <button
                key={step.label}
                className="group flex min-h-24 items-start gap-3 rounded-md border bg-background p-3 text-left transition hover:border-primary/50 hover:bg-muted"
                onClick={() => onNavigate(step.view)}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-signal/10 text-signal">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {step.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {step.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AccountsView({
  accounts,
  selectedAccount,
  publicMode,
  signals,
  draftAccount,
  draftContact,
  setDraftAccount,
  setDraftContact,
  onAddAccount,
  onAddContact,
  onSelectAccount,
  onCompleteAction,
}: {
  accounts: Account[];
  selectedAccount: Account | undefined;
  publicMode: boolean;
  signals: Signal[];
  draftAccount: typeof emptyAccountDraft;
  draftContact: typeof emptyContactDraft;
  setDraftAccount: React.Dispatch<React.SetStateAction<typeof emptyAccountDraft>>;
  setDraftContact: React.Dispatch<React.SetStateAction<typeof emptyContactDraft>>;
  onAddAccount: (event: FormEvent<HTMLFormElement>) => void;
  onAddContact: (event: FormEvent<HTMLFormElement>) => void;
  onSelectAccount: (accountId: string) => void;
  onCompleteAction: (accountId: string) => void;
}) {
  const accountSignals = signals.filter(
    (signal) => signal.accountId === selectedAccount?.id,
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="space-y-3">
        <AccountSetupCard
          draftAccount={draftAccount}
          setDraftAccount={setDraftAccount}
          onAddAccount={onAddAccount}
        />

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            Accounts
          </div>
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-sm font-semibold">No accounts match the current search.</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Clear the search query or add a new local account.
                </p>
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <button
                key={account.id}
                className={cn(
                  "w-full rounded-lg border bg-card p-4 text-left transition hover:border-primary/50",
                  selectedAccount?.id === account.id && "border-primary shadow-focus",
                )}
                onClick={() => onSelectAccount(account.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{account.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {account.segment}
                    </div>
                  </div>
                  <Badge tone={priorityTone[account.priority]}>{account.priority}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <MiniStat label="Health" value={`${account.health}%`} />
                  <MiniStat label="Fit" value={`${account.fit}%`} />
                  <MiniStat
                    label="ARR"
                    value={publicMode ? "Hidden" : formatCurrency(account.arr)}
                  />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedAccount ? (
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{selectedAccount.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {publicMode ? "Domain hidden in Buildroom mode" : selectedAccount.domain}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="account">{selectedAccount.stage.replace("_", " ")}</Badge>
                <Badge tone="muted">{selectedAccount.owner}</Badge>
                <Badge tone="signal">{selectedAccount.sourceConfidence}% evidence</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <MiniStat label="Health" value={`${selectedAccount.health}%`} />
              <MiniStat label="Fit" value={`${selectedAccount.fit}%`} />
              <MiniStat
                label="Annual value"
                value={publicMode ? "Hidden" : formatCurrency(selectedAccount.arr)}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <InfoList title="Needs" items={selectedAccount.needs} tone="success" />
              <InfoList title="Risks" items={publicMode ? ["Private risk notes hidden"] : selectedAccount.risks} tone="warning" />
            </div>

            <ContactsPanel
              account={selectedAccount}
              publicMode={publicMode}
              draftContact={draftContact}
              setDraftContact={setDraftContact}
              onAddContact={onAddContact}
            />

            <div className="mt-5 rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Next action</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedAccount.nextAction.label}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={selectedAccount.nextAction.status === "done" ? "secondary" : "primary"}
                  disabled={selectedAccount.nextAction.status === "done"}
                  onClick={() => onCompleteAction(selectedAccount.id)}
                >
                  <Check className="h-4 w-4" />
                  {selectedAccount.nextAction.status === "done" ? "Complete" : "Mark done"}
                </Button>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 text-sm font-semibold">Linked signals</div>
              <div className="space-y-3">
                {accountSignals.length === 0 ? (
                  <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                    No signals yet. Capture a call note, ticket summary, review,
                    or usage observation to build account memory.
                  </div>
                ) : (
                  accountSignals.map((signal) => (
                    <SignalRow
                      key={signal.id}
                      signal={signal}
                      accountName={selectedAccount.name}
                    />
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="text-sm font-semibold">No account selected</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a local account or clear the search query to continue.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AccountSetupCard({
  draftAccount,
  setDraftAccount,
  onAddAccount,
}: {
  draftAccount: typeof emptyAccountDraft;
  setDraftAccount: React.Dispatch<React.SetStateAction<typeof emptyAccountDraft>>;
  onAddAccount: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add account</CardTitle>
        <p className="text-sm text-muted-foreground">
          Start a real local workspace without importing a whole CRM first.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onAddAccount}>
          <label className="block space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Account name</span>
            <input
              className="focus-input w-full"
              value={draftAccount.name}
              onChange={(event) =>
                setDraftAccount((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Acme Studio"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Domain</span>
            <input
              className="focus-input w-full"
              value={draftAccount.domain}
              onChange={(event) =>
                setDraftAccount((current) => ({ ...current, domain: event.target.value }))
              }
              placeholder="acme.example"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Segment</span>
              <input
                className="focus-input w-full"
                value={draftAccount.segment}
                onChange={(event) =>
                  setDraftAccount((current) => ({ ...current, segment: event.target.value }))
                }
                placeholder="Founder-led B2B"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Owner</span>
              <input
                className="focus-input w-full"
                value={draftAccount.owner}
                onChange={(event) =>
                  setDraftAccount((current) => ({ ...current, owner: event.target.value }))
                }
                placeholder="Maya"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Stage</span>
              <select
                className="focus-input w-full"
                value={draftAccount.stage}
                onChange={(event) =>
                  setDraftAccount((current) => ({
                    ...current,
                    stage: event.target.value as AccountStage,
                  }))
                }
              >
                {accountStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Priority</span>
              <select
                className="focus-input w-full"
                value={draftAccount.priority}
                onChange={(event) =>
                  setDraftAccount((current) => ({
                    ...current,
                    priority: event.target.value as Priority,
                  }))
                }
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-medium text-muted-foreground">First next action</span>
            <input
              className="focus-input w-full"
              value={draftAccount.nextAction}
              onChange={(event) =>
                setDraftAccount((current) => ({ ...current, nextAction: event.target.value }))
              }
              placeholder="Book discovery follow-up"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Primary contact</span>
              <input
                className="focus-input w-full"
                value={draftAccount.contactName}
                onChange={(event) =>
                  setDraftAccount((current) => ({
                    ...current,
                    contactName: event.target.value,
                  }))
                }
                placeholder="Lena Park"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Contact role</span>
              <input
                className="focus-input w-full"
                value={draftAccount.contactRole}
                onChange={(event) =>
                  setDraftAccount((current) => ({
                    ...current,
                    contactRole: event.target.value,
                  }))
                }
                placeholder="Founder"
              />
            </label>
          </div>

          <Button type="submit" variant="primary">
            <Users className="h-4 w-4" />
            Add account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ContactsPanel({
  account,
  publicMode,
  draftContact,
  setDraftContact,
  onAddContact,
}: {
  account: Account;
  publicMode: boolean;
  draftContact: typeof emptyContactDraft;
  setDraftContact: React.Dispatch<React.SetStateAction<typeof emptyContactDraft>>;
  onAddContact: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="mt-5 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Contacts</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep relationship memory close to the account, not in a detached
            address book.
          </p>
        </div>
        <Badge tone="muted">{account.contacts.length} people</Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {account.contacts.length === 0 ? (
          <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
            No contacts yet.
          </div>
        ) : (
          account.contacts.map((contact) => (
            <div key={contact.id} className="rounded-md border bg-card p-3">
              <div className="text-sm font-semibold">
                {publicMode ? "Contact name hidden" : contact.name}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {contact.role} · {contact.influence} · Last seen {formatDate(contact.lastSeen)}
              </div>
            </div>
          ))
        )}
      </div>

      <form className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_160px_auto]" onSubmit={onAddContact}>
        <label className="block space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Contact name</span>
          <input
            className="focus-input w-full"
            value={draftContact.name}
            onChange={(event) =>
              setDraftContact((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="New contact"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          <input
            className="focus-input w-full"
            value={draftContact.role}
            onChange={(event) =>
              setDraftContact((current) => ({ ...current, role: event.target.value }))
            }
            placeholder="Operations lead"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Influence</span>
          <select
            className="focus-input w-full"
            value={draftContact.influence}
            onChange={(event) =>
              setDraftContact((current) => ({
                ...current,
                influence: event.target.value as Contact["influence"],
              }))
            }
          >
            {contactInfluences.map((influence) => (
              <option key={influence} value={influence}>
                {influence}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <Button type="submit" variant="secondary">
            Add contact
          </Button>
        </div>
      </form>
    </div>
  );
}

function SignalsView({
  workspace,
  accountsById,
  draftSignal,
  setDraftSignal,
  onSubmit,
}: {
  workspace: Workspace;
  accountsById: Map<string, Account>;
  draftSignal: {
    accountId: string;
    source: SignalSource;
    title: string;
    body: string;
  };
  setDraftSignal: React.Dispatch<
    React.SetStateAction<{
      accountId: string;
      source: SignalSource;
      title: string;
      body: string;
    }>
  >;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Capture Signal</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add a call note, ticket summary, public review, community post, or
            market observation with a linked account.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Account</span>
              <select
                className="focus-input w-full"
                value={draftSignal.accountId}
                onChange={(event) =>
                  setDraftSignal((current) => ({
                    ...current,
                    accountId: event.target.value,
                  }))
                }
              >
                {workspace.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Source</span>
              <select
                className="focus-input w-full"
                value={draftSignal.source}
                onChange={(event) =>
                  setDraftSignal((current) => ({
                    ...current,
                    source: event.target.value as SignalSource,
                  }))
                }
              >
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Title</span>
              <input
                className="focus-input w-full"
                value={draftSignal.title}
                onChange={(event) =>
                  setDraftSignal((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Short source-grounded summary"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Body</span>
              <textarea
                className="focus-input min-h-36 w-full resize-y"
                value={draftSignal.body}
                onChange={(event) =>
                  setDraftSignal((current) => ({ ...current, body: event.target.value }))
                }
                placeholder="What was said, observed, or requested?"
              />
            </label>
            <Button type="submit" variant="primary">
              <MessageSquarePlus className="h-4 w-4" />
              Add signal
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signal Inbox</CardTitle>
          <p className="text-sm text-muted-foreground">
            A useful CRM should behave like source memory, not just an activity log.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {workspace.signals.map((signal) => (
            <SignalRow
              key={signal.id}
              signal={signal}
              accountName={accountsById.get(signal.accountId)?.name ?? "Unknown account"}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function FeedbackView({
  workspace,
  draftFeedback,
  setDraftFeedback,
  onSubmit,
}: {
  workspace: Workspace;
  draftFeedback: {
    mode: FeedbackMode;
    accountId: string;
    workflowArea: string;
    title: string;
    body: string;
  };
  setDraftFeedback: React.Dispatch<
    React.SetStateAction<{
      mode: FeedbackMode;
      accountId: string;
      workflowArea: string;
      title: string;
      body: string;
    }>
  >;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const mode = feedbackModes[draftFeedback.mode];
  const destinationSteps = mode.createsIdea
    ? [
        "Create source-grounded signal",
        "Create idea candidate",
        "Create Codex triage task",
        `Prepare for ${mode.publicSurface}`,
      ]
    : [
        "Create private signal",
        "Hold for pattern detection",
        "Avoid public projection",
        "Use during insight synthesis",
      ];

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <CardTitle>Tell Open CRM</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test how feedback becomes Zentrik signal, idea candidates, and agent
            work without exposing private CRM data by default.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(feedbackModes) as FeedbackMode[]).map((modeId) => {
                const option = feedbackModes[modeId];
                return (
                  <button
                    key={modeId}
                    type="button"
                    className={cn(
                      "rounded-md border p-3 text-left transition hover:border-primary/50",
                      draftFeedback.mode === modeId
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground",
                    )}
                    onClick={() =>
                      setDraftFeedback((current) => ({ ...current, mode: modeId }))
                    }
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span
                      className={cn(
                        "mt-1 block text-xs leading-5",
                        draftFeedback.mode === modeId
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {option.summary}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Source account
                </span>
                <select
                  className="focus-input w-full"
                  value={draftFeedback.accountId}
                  onChange={(event) =>
                    setDraftFeedback((current) => ({
                      ...current,
                      accountId: event.target.value,
                    }))
                  }
                >
                  {workspace.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Workflow area
                </span>
                <select
                  className="focus-input w-full"
                  value={draftFeedback.workflowArea}
                  onChange={(event) =>
                    setDraftFeedback((current) => ({
                      ...current,
                      workflowArea: event.target.value,
                    }))
                  }
                >
                  {workflowAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                Feedback title
              </span>
              <input
                className="focus-input w-full"
                value={draftFeedback.title}
                onChange={(event) =>
                  setDraftFeedback((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Short, specific product feedback"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                What happened, and what should be better?
              </span>
              <textarea
                className="focus-input min-h-40 w-full resize-y"
                value={draftFeedback.body}
                onChange={(event) =>
                  setDraftFeedback((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
                placeholder="Describe the workflow, friction, expected result, and any safe reproduction context."
              />
            </label>

            <Button type="submit" variant="primary">
              <Lightbulb className="h-4 w-4" />
              Send through loop
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Loop Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              This is what Zentrik and agents would receive from the selected mode.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {destinationSteps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-lg border bg-background p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-signal/10 text-xs font-semibold text-signal">
                  {index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold">{step}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {index === 0
                      ? mode.sourceRef
                      : index === destinationSteps.length - 1
                        ? mode.publicSurface
                        : "Zentrik links this to existing insights and ideas before work starts."}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Why This Mode Exists</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Private signal is safest for rough context. Buildroom request is best
              when the user wants the community to vote. GitHub issue is best when
              the feedback is reproducible and implementation-ready.
            </p>
            <div className="rounded-lg border bg-background p-3 text-xs leading-5">
              <span className="font-semibold text-foreground">Privacy rule: </span>
              raw account context stays private unless the user explicitly chooses
              a public-safe route.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoopView({
  workspace,
  accountsById,
  onApproveIdea,
}: {
  workspace: Workspace;
  accountsById: Map<string, Account>;
  onApproveIdea: (ideaId: string) => void;
}) {
  return (
    <div className="section-grid">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {workspace.ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} onApproveIdea={onApproveIdea} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Open CRM Buildroom</CardTitle>
            <p className="text-sm text-muted-foreground">
              Public-safe view of what users asked for, what the product is
              considering, and what shipped.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspace.signals.map((signal) => {
              const account = accountsById.get(signal.accountId);
              return (
                <div key={signal.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="signal">{signal.source}</Badge>
                    <Badge tone={priorityTone[signal.impact]}>{signal.impact}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {account?.segment ?? "General market"}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-medium">{signal.title}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {signal.body}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolution Log</CardTitle>
            <p className="text-sm text-muted-foreground">
              The product should explain why it changed and what evidence moved it.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {workspace.evolutionLog.map((entry) => (
              <div key={entry.id} className="border-l-2 border-accent pl-4">
                <div className="text-xs text-muted-foreground">
                  {formatDate(entry.date)}
                </div>
                <div className="mt-1 text-sm font-semibold">{entry.title}</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {entry.summary}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.evidence.map((item) => (
                    <Badge key={item} tone="muted">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CodexView({
  workspace,
  accountsById,
  copiedTaskId,
  copyErrorTaskId,
  onCopyPrompt,
}: {
  workspace: Workspace;
  accountsById: Map<string, Account>;
  copiedTaskId: string | null;
  copyErrorTaskId: string | null;
  onCopyPrompt: (task: CodexTask) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Codex Task Queue</CardTitle>
          <p className="text-sm text-muted-foreground">
            Agent work should start from explicit context, source boundaries, and
            human review.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {workspace.codexTasks.map((task) => {
            const account = task.accountId ? accountsById.get(task.accountId) : undefined;
            return (
              <div key={task.id} className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="agent">{task.status.replace("_", " ")}</Badge>
                      {account && <Badge tone="account">{account.name}</Badge>}
                    </div>
                    <div className="mt-3 text-sm font-semibold">{task.title}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {task.prompt}
                    </p>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => onCopyPrompt(task)}>
                    <Sparkles className="h-4 w-4" />
                    {copiedTaskId === task.id
                      ? "Copied"
                      : copyErrorTaskId === task.id
                        ? "Copy failed"
                        : "Copy prompt"}
                  </Button>
                </div>
                <div className="mt-3 rounded-md border bg-card p-3 text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground">Guardrail: </span>
                  {task.guardrail}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Operating Contract</CardTitle>
          <p className="text-sm text-muted-foreground">
            The CRM is designed so Codex can help without becoming an unchecked
            black box.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            "Read workspace records, docs, and linked signals before proposing action.",
            "Cite the account, signal, idea, or release evidence behind every recommendation.",
            "Draft work for human approval before sending customer-facing messages.",
            "Never use private data from another workspace or public demo fixture.",
            "Record meaningful work in the Evolution Log so the product can learn over time.",
          ].map((item) => (
            <div key={item} className="flex gap-3 rounded-lg border bg-background p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p className="text-sm leading-6 text-muted-foreground">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsView({
  onExport,
  onReset,
}: {
  onExport: () => void;
  onReset: () => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Local Data</CardTitle>
          <p className="text-sm text-muted-foreground">
            This version persists workspace changes in browser local storage.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onExport}>
            <FileDown className="h-4 w-4" />
            Export JSON
          </Button>
          <Button variant="secondary" onClick={onReset}>
            <RefreshCcw className="h-4 w-4" />
            Reset demo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Self-Hosted Path</CardTitle>
          <p className="text-sm text-muted-foreground">
            The first release keeps data local. Server-backed storage, auth, and
            connector workers can be added behind the same workspace model.
          </p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Start with the local workspace.</p>
          <p>2. Add your own data directory or API adapter.</p>
          <p>3. Connect Codex with the repository instructions.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy Boundary</CardTitle>
          <p className="text-sm text-muted-foreground">
            Public fixtures should stay synthetic. Private account work belongs
            in private workspaces or encrypted hosted instances.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {["No API keys", "No customer exports", "No private transcripts"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-success" />
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: typeof Home;
  tone?: "default" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-4">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="metric-value">{value}</div>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-signal/10 text-signal",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function SignalRow({
  signal,
  accountName,
}: {
  signal: Signal;
  accountName: string;
}) {
  return (
    <article className="rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="signal">{signal.source}</Badge>
        <Badge tone={priorityTone[signal.impact]}>{signal.impact}</Badge>
        <span className="text-xs text-muted-foreground">
          {accountName} · {formatDate(signal.receivedAt)}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-semibold">{signal.title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{signal.body}</p>
      <div className="mt-2 text-xs text-muted-foreground">Source: {signal.sourceRef}</div>
    </article>
  );
}

function IdeaCard({
  idea,
  onApproveIdea,
}: {
  idea: Idea;
  onApproveIdea: (ideaId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <Badge tone="idea">{idea.status}</Badge>
          <span className="text-xs text-muted-foreground">{idea.confidence}% confidence</span>
        </div>
        <CardTitle>{idea.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="min-h-24 text-sm leading-6 text-muted-foreground">{idea.problem}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {idea.votes} votes · {idea.targetRelease}
          </div>
          <Button size="sm" variant="secondary" onClick={() => onApproveIdea(idea.id)}>
            Advance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function InfoList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "warning";
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 rounded-md border bg-background p-3">
            <span
              className={cn(
                "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                tone === "success" ? "bg-success" : "bg-warning",
              )}
            />
            <p className="text-sm leading-6 text-muted-foreground">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
