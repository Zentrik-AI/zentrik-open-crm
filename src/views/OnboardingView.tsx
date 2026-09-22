import { useRef, useState } from "react";
import { brand } from "../lib/brand";
import {
  ArrowLeft,
  Bot,
  Building2,
  FileUp,
  ListTodo,
  LockKeyhole,
  NotebookPen,
  Play,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/field";

export type WorkspaceSetupDraft = {
  workspaceName: string;
  accountName: string;
  domain: string;
  segment: string;
  owner: string;
  contactName: string;
  contactRole: string;
};

const emptySetup: WorkspaceSetupDraft = {
  workspaceName: "My CRM workspace",
  accountName: "",
  domain: "",
  segment: "",
  owner: "",
  contactName: "",
  contactRole: "",
};

const loop = [
  { icon: Building2, label: "Remember the account", detail: "Start with one real relationship, not a full migration." },
  { icon: NotebookPen, label: "Capture what happened", detail: "Keep a source reference beside every useful note." },
  { icon: ListTodo, label: "Choose the next action", detail: "Humans own the decision and the customer relationship." },
  { icon: Bot, label: "Hand work to an agent", detail: "Copy explicit context and guardrails before an agent starts." },
];

export function OnboardingView({
  onCreateWorkspace,
  onImport,
  onUseDemo,
  onClose,
  folderBacked = false,
  workspaceName,
}: {
  onCreateWorkspace: (draft: WorkspaceSetupDraft) => void;
  onImport: (file: File) => void;
  onUseDemo: () => void;
  onClose?: () => void;
  folderBacked?: boolean;
  /** The name an existing, still-empty workspace folder was created with. */
  workspaceName?: string;
}) {
  const [draft, setDraft] = useState(() => ({ ...emptySetup, workspaceName: workspaceName || emptySetup.workspaceName }));
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<WorkspaceSetupDraft>) => setDraft((current) => ({ ...current, ...patch }));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.workspaceName.trim() || !draft.accountName.trim()) return;
    onCreateWorkspace(draft);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-xl border border-border bg-surface shadow-e2 lg:grid-cols-[0.88fr_1.12fr]">
        <section className="relative border-b border-border bg-surface-sunken/60 px-6 py-7 sm:px-8 sm:py-9 lg:border-b-0 lg:border-r lg:px-10 lg:py-12">
          {onClose && (
            <Button variant="ghost" size="sm" className="mb-7 -ml-2" onClick={onClose}>
              <ArrowLeft />
              Back to workspace
            </Button>
          )}

          <div className="flex items-center gap-2 text-label uppercase text-accent-fg">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </span>
            {brand.fullName}
          </div>
          <h1 className="mt-5 max-w-lg font-serif text-[2rem] font-medium leading-[1.08] tracking-[-0.025em] sm:text-[2.5rem]">
            Start with one relationship worth remembering.
          </h1>
          <p className="mt-4 max-w-lg text-body leading-relaxed text-muted-foreground">
            You do not need to import an entire sales system. Add one real account, capture the source behind the work, and build from there.
          </p>

          <ol className="mt-8 hidden border-l border-border pl-5 sm:block sm:mt-10">
            {loop.map(({ icon: Icon, label, detail }, index) => (
              <li key={label} className="relative pb-6 last:pb-0">
                <span
                  className={`absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-surface ${
                    index === loop.length - 1 ? "border-agent text-agent-fg" : "border-accent text-accent-fg"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="text-h3 text-foreground">{label}</div>
                <p className="mt-0.5 text-body-sm text-muted-foreground">{detail}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex items-start gap-2.5 border-t border-border pt-5 text-body-sm text-muted-foreground sm:mt-9">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p>
              {folderBacked
                ? "Your workspace is saved to its folder on this computer. No account is required."
                : "Your workspace stays in this browser until you export or sync it. No account is required."}
            </p>
          </div>
        </section>

        <section className="px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-12" aria-labelledby="setup-title">
          <div className="max-w-2xl">
            <div className="text-label uppercase text-muted-foreground">Recommended start</div>
            <h2 id="setup-title" className="mt-1 font-serif text-h1 text-foreground">Create your local workspace</h2>
            <p className="mt-1.5 text-body-sm text-muted-foreground">
              We will create the workspace and its first account. Everything else can wait until it is useful.
            </p>

            <form className="mt-7 space-y-5" onSubmit={submit}>
              <Field label="Workspace name">
                <Input
                  autoFocus
                  value={draft.workspaceName}
                  onChange={(event) => set({ workspaceName: event.target.value })}
                  placeholder="My CRM workspace"
                  required
                />
              </Field>

              <div className="border-t border-border pt-5">
                <div className="mb-4 text-label uppercase text-muted-foreground">First account</div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field label="Account name" className="sm:col-span-2">
                    <Input
                      value={draft.accountName}
                      onChange={(event) => set({ accountName: event.target.value })}
                      placeholder="Acme Studio"
                      required
                    />
                  </Field>
                  <Field label="Domain" hint="Optional — used only for recognition.">
                    <Input value={draft.domain} onChange={(event) => set({ domain: event.target.value })} placeholder="acme.example" />
                  </Field>
                  <Field label="Relationship" hint="A useful description, not a database category.">
                    <Input value={draft.segment} onChange={(event) => set({ segment: event.target.value })} placeholder="Design partner" />
                  </Field>
                  <Field label="Owner">
                    <Input value={draft.owner} onChange={(event) => set({ owner: event.target.value })} placeholder="Your name" />
                  </Field>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <div className="mb-4 text-label uppercase text-muted-foreground">Primary contact · optional</div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field label="Name">
                    <Input value={draft.contactName} onChange={(event) => set({ contactName: event.target.value })} placeholder="Lena Park" />
                  </Field>
                  <Field label="Role">
                    <Input value={draft.contactRole} onChange={(event) => set({ contactRole: event.target.value })} placeholder="Founder" />
                  </Field>
                </div>
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto">
                Create workspace
              </Button>
            </form>

            <div className="mt-8 border-t border-border pt-5">
              <div className="text-label uppercase text-muted-foreground">Already have data?</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" size="lg" onClick={() => fileRef.current?.click()}>
                  <FileUp />
                  Import {brand.name} backup
                </Button>
                <input
                  ref={fileRef}
                  className="hidden"
                  type="file"
                  accept="application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImport(file);
                    event.target.value = "";
                  }}
                />
                <Button variant="ghost" size="lg" onClick={onUseDemo}>
                  <Play />
                  Explore with demo data
                </Button>
              </div>
              <p className="mt-3 text-[12px] text-faint-foreground">
                Demo records are synthetic and clearly separate from a workspace you create.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
