import { useState, type FormEvent } from "react";
import { Check, Plus, X } from "lucide-react";
import type { Account, ClaimKind, Note, Op } from "../types";
import type { AccountMemory, GroundedClaim } from "../core/memory";
import { claimKindMeta, claimKindOrder } from "../lib/meta";
import { toneSolidBg } from "../lib/tone";
import { cn, formatRelative } from "../lib/utils";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";
import { RedactedChip, useShareSafe } from "./ui/privacy";
import { Grounding } from "./grounding";

type ClaimAdd = Extract<Op, { type: "claim.add" }>;

/** One thing we know: its text, how it is grounded, who said it, how old. */
function ClaimRow({
  g,
  notesById,
  onTrace,
  onResolve,
}: {
  g: GroundedClaim;
  notesById: Map<string, Note>;
  onTrace: (id: string) => void;
  onResolve: (id: string, reason: string) => boolean;
}) {
  const shareSafe = useShareSafe();
  const meta = claimKindMeta[g.claim.kind];
  const [resolving, setResolving] = useState(false);
  const [reason, setReason] = useState("");
  const hidden = shareSafe && meta.sensitive;
  return (
    <li className="group flex gap-2.5 rounded-md border border-border bg-surface p-3 transition-colors duration-fast hover:border-border-strong">
      <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", toneSolidBg[meta.tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        {hidden ? (
          <RedactedChip label={`${meta.label.toLowerCase()} hidden in share-safe view`} />
        ) : (
          <>
            <p className="text-body text-foreground">{g.claim.text}</p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-faint-foreground">
              <Grounding evidence={g.claim.evidence} notesById={notesById} onClick={() => onTrace(g.claim.id)} />
              {g.contact && <span className="text-muted-foreground">{g.contact.name}</span>}
              {g.claim.kind === "commitment" && (
                <span className={cn("font-mono tabular-nums", g.overdue ? "text-destructive-fg" : "text-muted-foreground")}>
                  {g.claim.owner === "them" ? "theirs" : "ours"}
                  {g.claim.due ? ` · ${g.overdue ? "was due" : "by"} ${formatRelative(g.claim.due)}` : ""}
                </span>
              )}
              {g.latest && (
                <span className={cn("font-mono tabular-nums", g.stale && "text-warning-fg")} title={g.stale ? "Evidence is older than 45 days; worth re-checking" : "Newest evidence"}>
                  {g.ageDays === 0 ? "today" : `${g.ageDays}d`}
                  {g.stale ? " · stale" : ""}
                </span>
              )}
            </div>
            {resolving && (
              <form
                className="mt-2 flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (onResolve(g.claim.id, reason)) setResolving(false);
                }}
              >
                <Field label="No longer true because" className="min-w-0 flex-1">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Legal cleared the rollout on the June call" autoFocus required />
                </Field>
                <Button type="submit" size="sm" variant="secondary">
                  <Check />
                  Resolve
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setResolving(false)}>
                  Cancel
                </Button>
              </form>
            )}
          </>
        )}
      </div>
      {!hidden && !resolving && (
        <button
          onClick={() => setResolving(true)}
          aria-label="Mark no longer true"
          title="No longer true"
          className="h-6 w-6 shrink-0 rounded-sm text-faint-foreground opacity-0 transition-opacity duration-fast hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:focus-ring group-hover:opacity-100"
        >
          <X className="mx-auto h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function AddClaim({ account, notes, onAdd, onDone }: { account: Account; notes: Note[]; onAdd: (op: ClaimAdd) => boolean; onDone: () => void }) {
  const [kind, setKind] = useState<ClaimKind>("need");
  const [text, setText] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [contactId, setContactId] = useState("");
  const [owner, setOwner] = useState<"us" | "them">("them");
  const [due, setDue] = useState("");
  const recent = [...notes].sort((a, b) => (b.occurredAt ?? b.createdAt).localeCompare(a.occurredAt ?? a.createdAt)).slice(0, 6);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = onAdd({
      type: "claim.add",
      accountId: account.id,
      kind,
      text,
      evidence,
      contactId: contactId || undefined,
      owner: kind === "commitment" ? owner : undefined,
      due: kind === "commitment" && due ? due : undefined,
    });
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-border bg-surface-sunken p-3">
      <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
        <Field label="Kind">
          <Select value={kind} onChange={(e) => setKind(e.target.value as ClaimKind)}>
            {claimKindOrder.map((k) => (
              <option key={k} value={k}>
                {claimKindMeta[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="One idea">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Legal needs a data-flow diagram before the pilot" required autoFocus />
        </Field>
      </div>
      <div>
        <div className="mb-1.5 text-label uppercase text-muted-foreground">Which notes say so</div>
        {recent.length === 0 ? (
          <p className="text-[12px] text-faint-foreground">No notes on this account yet. Without one, this is recorded as a hunch.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {recent.map((note) => (
              <label key={note.id} className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-0.5 text-[12px] text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={evidence.includes(note.id)}
                  onChange={(e) => setEvidence((cur) => (e.target.checked ? [...cur, note.id] : cur.filter((id) => id !== note.id)))}
                />
                <span className="min-w-0 truncate">{note.title}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Who said it">
          <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Not one person</option>
            {account.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {kind === "commitment" && (
          <>
            <Field label="Who owes it">
              <Select value={owner} onChange={(e) => setOwner(e.target.value as "us" | "them")}>
                <option value="them">They do</option>
                <option value="us">We do</option>
              </Select>
            </Field>
            <Field label="By when">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm">
          <Plus />
          Record
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <span className="text-[12px] text-faint-foreground">{evidence.length === 0 ? "No note selected: this will show as a hunch." : `${evidence.length} ${evidence.length === 1 ? "note" : "notes"} cited.`}</span>
      </div>
    </form>
  );
}

/** What we know about an account, grouped by kind, each line showing how it is grounded. */
export function KnowledgeList({
  memory,
  notes,
  notesById,
  onTrace,
  onAdd,
  onResolve,
}: {
  memory: AccountMemory;
  notes: Note[];
  notesById: Map<string, Note>;
  onTrace: (id: string) => void;
  onAdd: (op: ClaimAdd) => boolean;
  onResolve: (id: string, reason: string) => boolean;
}) {
  const shareSafe = useShareSafe();
  const [adding, setAdding] = useState(false);
  const groups = claimKindOrder.map((kind) => ({ kind, items: memory.byKind[kind] })).filter((g) => g.items.length > 0);
  return (
    <section aria-label="What we know" className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-label uppercase text-muted-foreground">What we know</span>
          <span className="font-mono text-[11px] tabular-nums text-faint-foreground">
            {memory.counts.grounded} grounded{memory.counts.hunches ? ` · ${memory.counts.hunches} ${memory.counts.hunches === 1 ? "hunch" : "hunches"}` : ""}
            {memory.counts.stale ? ` · ${memory.counts.stale} stale` : ""}
          </span>
        </div>
        {!adding && !shareSafe && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus />
            Record
          </Button>
        )}
      </div>
      {adding && <AddClaim account={memory.account} notes={notes} onAdd={onAdd} onDone={() => setAdding(false)} />}
      {groups.length === 0 && !adding ? (
        <div className="rounded-md border border-dashed border-border p-4 text-body-sm text-muted-foreground">
          Nothing recorded yet. Capture a note, then record what it says: a need, a risk, a goal, an objection, a commitment, or a fact.
        </div>
      ) : (
        <div className={cn("space-y-4", adding && "mt-4")}>
          {groups.map(({ kind, items }) => (
            <div key={kind}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className={cn("text-[12px] font-medium", `text-${claimKindMeta[kind].tone}-fg`)}>{claimKindMeta[kind].plural}</span>
                <span className="font-mono text-[11px] tabular-nums text-faint-foreground">{items.length}</span>
              </div>
              <ul className="space-y-2">
                {items.map((g) => (
                  <ClaimRow key={g.claim.id} g={g} notesById={notesById} onTrace={onTrace} onResolve={onResolve} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
