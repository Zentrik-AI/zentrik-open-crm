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
  { icon: Building2, label: "Remember the account" },
  { icon: NotebookPen, label: "Capture what happened, with its source" },
  { icon: ListTodo, label: "Choose the next action" },
  { icon: Bot, label: "Let an agent propose, you approve" },
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
    <main className="flex min-h-screen items-center bg-background px-4 py-6 text-foreground sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-e3 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="relative flex flex-col border-b border-border bg-surface-sunken/70 px-6 py-7 sm:px-8 sm:py-9 lg:border-b-0 lg:border-r lg:px-10 lg:py-11">
          {onClose && (
            <Button variant="ghost" size="sm" className="-ml-2 mb-6 self-start" onClick={onClose}>
              <ArrowLeft />
              Back to workspace
            </Button>
          )}

          <div className="flex items-center gap-2.5 text-body-sm font-semibold text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-e1">
              <Building2 className="h-4 w-4" />
            </span>
            {brand.fullName}
          </div>
          <h1 className="mt-8 max-w-sm text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[2.375rem]">
            Start with one relationship worth remembering.
          </h1>
          <p className="mt-3 max-w-sm text-body text-muted-foreground">
            No migration. Add one real relationship and build from there.
          </p>

          <ol className="mt-9 hidden space-y-3 sm:block">
            {loop.map(({ icon: Icon, label }, index) => (
              <li key={label} className="flex items-center gap-3 text-body-sm text-foreground">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-surface-raised shadow-e1 ${
                    index === loop.length - 1 ? "border-agent/40 text-agent" : "border-border text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {label}
              </li>
            ))}
          </ol>

          <div className="mt-auto flex items-start gap-2.5 pt-10 text-label text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-success" />
            <p>
              {folderBacked
                ? "Your workspace is saved to its folder on this computer. No account is required."
                : "Your workspace stays in this browser until you export or sync it. No account is required."}
            </p>
          </div>
        </section>

        <section className="px-6 py-7 sm:px-8 sm:py-9 lg:px-11 lg:py-11" aria-labelledby="setup-title">
          <div className="max-w-2xl">
            <h2 id="setup-title" className="text-h1 text-foreground">Create your local workspace</h2>
            <p className="mt-1 text-body-sm text-muted-foreground">A workspace and its first account. The rest can wait.</p>

            <form className="mt-7 space-y-6" onSubmit={submit}>
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
                <div className="mb-3 text-body-sm font-semibold text-foreground">First account</div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field label="Account name" className="sm:col-span-2">
                    <Input
                      value={draft.accountName}
                      onChange={(event) => set({ accountName: event.target.value })}
                      placeholder="Acme Studio"
                      required
                    />
                  </Field>
                  <Field label="Domain">
                    <Input value={draft.domain} onChange={(event) => set({ domain: event.target.value })} placeholder="acme.example · optional" />
                  </Field>
                  <Field label="Relationship">
                    <Input value={draft.segment} onChange={(event) => set({ segment: event.target.value })} placeholder="Design partner" />
                  </Field>
                  <Field label="Owner">
                    <Input value={draft.owner} onChange={(event) => set({ owner: event.target.value })} placeholder="Your name" />
                  </Field>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <div className="mb-3 text-body-sm font-semibold text-foreground">Primary contact <span className="font-normal text-faint-foreground">· optional</span></div>
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

            <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="whitespace-nowrap text-body-sm text-muted-foreground">Already have data?</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
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
                <Button variant="secondary" onClick={onUseDemo}>
                  <Play />
                  Explore with demo data
                </Button>
              </div>

            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
