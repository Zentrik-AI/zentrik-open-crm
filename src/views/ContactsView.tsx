import { useMemo, useState } from "react";
import { ArrowUpRight, Quote, Search } from "lucide-react";
import type { Account } from "../types";
import { influenceMeta } from "../lib/meta";
import { cn, formatDateFull, formatRelative } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Monogram } from "../components/ui/monogram";
import { Private, useShareSafe } from "../components/ui/privacy";
import { EmptyState } from "../components/ui/empty-state";

/** Name · account · role · last contact · trace, as one 44px row from md up. */
const gridCols = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_120px_110px_120px] md:gap-x-4";

export function ContactsView({
  accounts,
  onSelectAccount,
  onTrace,
}: {
  accounts: Account[];
  onSelectAccount: (id: string) => void;
  onTrace: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const shareSafe = useShareSafe();

  const people = useMemo(
    () =>
      accounts
        .flatMap((account) => account.contacts.map((contact) => ({ contact, account })))
        .sort((a, b) => (b.contact.lastSeen ?? "").localeCompare(a.contact.lastSeen ?? "")),
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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-h1 text-foreground">Contacts</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            <span className="tnum">{people.length}</span> {people.length === 1 ? "person" : "people"}, most recent first
          </p>
        </div>
        <label className="relative w-full sm:w-[240px]">
          <span className="sr-only">Search people</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people"
            className="h-8 w-full rounded-lg border border-border bg-surface-raised pl-8 pr-3 text-body-sm text-foreground shadow-e1 outline-none transition-[border-color,box-shadow] duration-fast placeholder:text-faint-foreground hover:border-border-strong focus:border-ring focus:focus-ring"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={q.trim() ? "No one matches that search" : "No contacts yet"}
          action={q.trim() ? <Button variant="secondary" size="sm" onClick={() => setQ("")}>Clear search</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-e1">
          <div className={cn(gridCols, "hidden h-9 items-center border-b border-border bg-surface-sunken/60 px-4 text-label font-normal text-faint-foreground md:grid")} aria-hidden>
            <span>Name</span>
            <span>Account</span>
            <span>Role in deal</span>
            <span className="text-right">Last contact</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {filtered.map(({ contact, account }, index) => {
              const meta = influenceMeta[contact.influence];
              const lastSeen = contact.lastSeen ? formatRelative(contact.lastSeen) : null;
              return (
                <li
                  key={contact.id}
                  className={cn(gridCols, "group grid animate-settle items-center gap-y-1 px-4 py-2.5 transition-colors duration-fast hover:bg-secondary/60 md:min-h-[44px] md:py-1.5")}
                  style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Monogram name={contact.name} tone="neutral" redacted={shareSafe} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-body-sm font-medium text-foreground">
                        <Private redactedLabel="name hidden">{contact.name}</Private>
                      </div>
                      <div className="truncate text-label font-normal text-faint-foreground">
                        {contact.role}
                        {contact.email && (
                          <span className="hidden lg:inline">
                            {" · "}
                            <Private redactedLabel="email hidden">{contact.email}</Private>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 pl-10 md:pl-0">
                    <button
                      onClick={() => onSelectAccount(account.id)}
                      className="inline-flex max-w-full items-center gap-1 rounded-sm text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:focus-ring"
                    >
                      <span className="truncate">{account.name}</span>
                      <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </button>
                  </div>
                  <div className="hidden md:block">
                    <Badge tone="neutral">
                      {meta.label}
                    </Badge>
                  </div>
                  <span className="tnum hidden text-right text-body-sm text-faint-foreground md:block" title={contact.lastSeen ? formatDateFull(contact.lastSeen) : undefined}>
                    {lastSeen ? (lastSeen.startsWith("in ") || lastSeen === "now" ? lastSeen : `${lastSeen} ago`) : "Unknown"}
                  </span>
                  <div className="pl-10 md:pl-0 md:text-right">
                    <button
                      onClick={() => onTrace(contact.id)}
                      className="inline-flex items-center gap-1.5 rounded-sm text-body-sm text-muted-foreground transition-colors duration-fast hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring"
                    >
                      <Quote className="h-3.5 w-3.5 text-accent" aria-hidden />
                      What they said
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
