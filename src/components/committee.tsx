import type { FormEvent } from "react";
import { UserPlus } from "lucide-react";
import type { CommitteeLane } from "../core/memory";
import { contactInfluences, type ContactDraft } from "../lib/drafts";
import { influenceMeta } from "../lib/meta";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";
import { Monogram } from "./ui/monogram";
import { Private, useShareSafe } from "./ui/privacy";

/**
 * Who decides. Four lanes computed from the contacts: who signs off, who
 * pushes for it, who evaluates, who lives with it. An empty lane is a question
 * to ask, so it is drawn as one.
 */
export function CommitteeMap({
  lanes,
  draftContact,
  setDraftContact,
  onAddContact,
}: {
  lanes: CommitteeLane[];
  draftContact: ContactDraft;
  setDraftContact: React.Dispatch<React.SetStateAction<ContactDraft>>;
  onAddContact: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const shareSafe = useShareSafe();
  const set = (patch: Partial<ContactDraft>) => setDraftContact((c) => ({ ...c, ...patch }));
  const people = lanes.reduce((n, lane) => n + lane.members.length, 0);
  return (
    <section aria-label="Who decides" className="min-w-0">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-label uppercase text-muted-foreground">Who decides</span>
        <span className="font-mono text-[11px] tabular-nums text-faint-foreground">{people} {people === 1 ? "person" : "people"}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {lanes.map((lane) => {
          const meta = influenceMeta[lane.influence];
          const empty = lane.members.length === 0;
          return (
            <div key={lane.influence} className={cn("min-w-0 rounded-md border p-3", empty ? "border-dashed border-border-strong bg-transparent" : "border-border bg-surface")}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("text-[12px] font-medium", `text-${meta.tone}-fg`)}>{lane.label}</span>
                <span className="text-[11px] text-faint-foreground">{meta.label}</span>
              </div>
              {empty ? (
                <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                  No one recorded. <span className="text-foreground">{lane.ask}</span>
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {lane.members.map((m) => (
                    <li key={m.contact.id} className="flex min-w-0 items-center gap-2.5">
                      <Monogram name={m.contact.name} tone={meta.tone} size="sm" redacted={shareSafe} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-body-sm font-medium text-foreground">
                          <Private redactedLabel="name hidden">{m.contact.name}</Private>
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {m.contact.role}
                          {" · "}
                          <span className={cn("font-mono tabular-nums", m.daysSince === null ? "text-warning-fg" : m.daysSince > 30 ? "text-warning-fg" : "")}>
                            {m.daysSince === null ? "never seen" : m.daysSince === 0 ? "seen today" : `seen ${m.daysSince}d ago`}
                          </span>
                          {m.mentions > 0 && ` · ${m.mentions} ${m.mentions === 1 ? "note" : "notes"}`}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {!shareSafe && (
        <form className="mt-3 space-y-2" onSubmit={onAddContact}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Name">
              <Input value={draftContact.name} onChange={(e) => set({ name: e.target.value })} placeholder="New contact" />
            </Field>
            <Field label="Role">
              <Input value={draftContact.role} onChange={(e) => set({ role: e.target.value })} placeholder="Operations lead" />
            </Field>
          </div>
          <div className="grid items-end gap-2 grid-cols-[minmax(0,1fr)_auto]">
            <Field label="Part in the decision">
              <Select value={draftContact.influence} onChange={(e) => set({ influence: e.target.value as ContactDraft["influence"] })}>
                {contactInfluences.map((i) => (
                  <option key={i} value={i}>
                    {influenceMeta[i].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              <UserPlus />
              Add
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
