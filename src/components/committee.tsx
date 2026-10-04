import type { FormEvent } from "react";
import { UserPlus } from "lucide-react";
import type { CommitteeLane } from "../core/memory";
import { contactInfluences, type ContactDraft } from "../lib/drafts";
import { influenceMeta } from "../lib/meta";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";
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
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-h2 text-foreground">Who decides</h2>
        <span className="tnum text-label font-normal text-faint-foreground">
          {people} {people === 1 ? "person" : "people"}
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-e1">
        <ul className="divide-y divide-border">
          {lanes.map((lane) => {
            const meta = influenceMeta[lane.influence];
            const empty = lane.members.length === 0;
            return (
              <li key={lane.influence} className="min-w-0 px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-body-sm font-medium text-foreground">{lane.label}</span>
                  <span className="text-label font-normal text-faint-foreground">{meta.label}</span>
                </div>
                {empty ? (
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    <span className="text-faint-foreground">No one recorded.</span> {lane.ask}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {lane.members.map((m) => (
                      <li key={m.contact.id} className="flex min-w-0 items-center gap-2.5">
                        <Monogram name={m.contact.name} tone="neutral" size="sm" redacted={shareSafe} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-body-sm font-medium text-foreground">
                            <Private redactedLabel="name hidden">{m.contact.name}</Private>
                          </div>
                          <div className="truncate text-label font-normal text-muted-foreground">
                            {m.contact.role}
                            {" · "}
                            <span className={cn("tnum", (m.daysSince === null || m.daysSince > 30) && "text-warning-fg")}>
                              {m.daysSince === null ? "never seen" : m.daysSince === 0 ? "seen today" : `seen ${m.daysSince}d ago`}
                            </span>
                            {m.mentions > 0 && ` · ${m.mentions} ${m.mentions === 1 ? "note" : "notes"}`}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {!shareSafe && (
          <form className="border-t border-border bg-surface-sunken/60 px-4 py-3" onSubmit={onAddContact}>
            <div className="mb-2 text-label text-muted-foreground">Add a person</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input aria-label="Name" value={draftContact.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name" />
              <Input aria-label="Role" value={draftContact.role} onChange={(e) => set({ role: e.target.value })} placeholder="Role" />
            </div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Select aria-label="Part in the decision" value={draftContact.influence} onChange={(e) => set({ influence: e.target.value as ContactDraft["influence"] })}>
                {contactInfluences.map((i) => (
                  <option key={i} value={i}>
                    {influenceMeta[i].label}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary">
                <UserPlus />
                Add
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
