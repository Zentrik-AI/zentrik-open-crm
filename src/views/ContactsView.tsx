import { useMemo, useState } from "react";
import { ArrowUpRight, Mail, Search } from "lucide-react";
import type { Account } from "../types";
import { influenceMeta } from "../lib/meta";
import { formatRelative } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Monogram } from "../components/ui/monogram";
import { Private, useBuildroom } from "../components/ui/privacy";
import { EmptyState } from "../components/ui/empty-state";

export function ContactsView({
  accounts,
  onSelectAccount,
}: {
  accounts: Account[];
  onSelectAccount: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const buildroom = useBuildroom();

  const people = useMemo(
    () =>
      accounts
        .flatMap((account) => account.contacts.map((contact) => ({ contact, account })))
        .sort((a, b) => b.contact.lastSeen.localeCompare(a.contact.lastSeen)),
    [accounts],
  );

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return people;
    return people.filter(({ contact, account }) =>
      [contact.name, contact.role, contact.email ?? "", account.name, account.segment].join(" ").toLowerCase().includes(n),
    );
  }, [q, people]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-h1 text-foreground">Contacts</h1>
          <p className="mt-0.5 text-body-sm text-muted-foreground">Everyone across your accounts, most recent first.</p>
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people"
            className="h-9 w-[240px] rounded-md border border-border bg-surface-sunken pl-9 pr-3 text-body text-foreground outline-none transition-[border-color,box-shadow] duration-fast focus:border-ring focus:focus-ring placeholder:text-faint-foreground"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No contacts match." hint="Try a different search, or add contacts on an account." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ contact, account }) => {
            const meta = influenceMeta[contact.influence];
            return (
              <div key={contact.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Monogram name={contact.name} tone={meta.tone} redacted={buildroom} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-h3 text-foreground">
                      <Private redactedLabel="name hidden">{contact.name}</Private>
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">{contact.role}</div>
                  </div>
                  <Badge tone={meta.tone} dot>
                    {meta.label}
                  </Badge>
                </div>
                {contact.email && (
                  <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <Private redactedLabel="email hidden">{contact.email}</Private>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                  <button
                    onClick={() => onSelectAccount(account.id)}
                    className="inline-flex items-center gap-1 rounded-sm text-[12px] font-medium text-accent-fg hover:underline focus-visible:outline-none focus-visible:focus-ring"
                  >
                    {account.name}
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                  <span className="font-mono text-[11px] tabular-nums text-faint-foreground">{formatRelative(contact.lastSeen)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
