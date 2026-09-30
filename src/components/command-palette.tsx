import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Lock, Search, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { allNav, type View } from "../lib/nav";
import { sourceMeta, dealStageMeta } from "../lib/meta";
import type { Account, Deal, Note, Task } from "../types";
import { Ring } from "./ui/ring";
import { Kbd } from "./ui/kbd";

type Item = {
  key: string;
  group: string;
  label: string;
  sub?: string;
  icon?: LucideIcon;
  ring?: number;
  run: () => void;
};

export function CommandPalette({
  open,
  onClose,
  accounts,
  deals,
  notes,
  tasks,
  shareSafe,
  onNavigate,
  onSelectAccount,
  onTogglePrivacy,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  deals: Deal[];
  notes: Note[];
  tasks: Task[];
  shareSafe: boolean;
  onNavigate: (view: View) => void;
  onSelectAccount: (id: string) => void;
  onTogglePrivacy: () => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    setQ("");
    setActive(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      opener?.focus?.();
    };
  }, [open]);

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const items = useMemo<Item[]>(() => {
    const n = q.trim().toLowerCase();
    const match = (s: string) => s.toLowerCase().includes(n);

    const actions: Item[] = [
      ...allNav.map((nav) => ({
        key: `nav-${nav.id}`,
        group: "Go to",
        label: nav.label,
        icon: nav.icon,
        run: () => onNavigate(nav.id),
      })),
      {
        key: "toggle-privacy",
        group: "Go to",
        label: shareSafe ? "Switch to Private view" : "Switch to Share-safe view",
        icon: Lock,
        run: onTogglePrivacy,
      },
    ];

    const acc: Item[] = accounts.map((a) => ({
      key: `acct-${a.id}`,
      group: "Accounts",
      label: a.name,
      sub: a.segment,
      ring: a.health ?? undefined,
      run: () => onSelectAccount(a.id),
    }));

    const dl: Item[] = deals.map((d) => ({
      key: `deal-${d.id}`,
      group: "Deals",
      label: d.name,
      sub: `${dealStageMeta[d.stage].label} · ${accountName.get(d.accountId) ?? ""}`,
      run: () => onSelectAccount(d.accountId),
    }));

    const tk: Item[] = tasks
      .filter((t) => t.status === "open")
      .map((t) => ({
        key: `task-${t.id}`,
        group: "Tasks",
        label: t.title,
        sub: t.accountId ? accountName.get(t.accountId) : undefined,
        run: () => onNavigate("tasks"),
      }));

    // Note titles can carry sensitive free text — omit them from search in share-safe mode.
    const nt: Item[] = shareSafe
      ? []
      : notes.slice(0, 12).map((nNote) => ({
          key: `note-${nNote.id}`,
          group: "Notes",
          label: nNote.title,
          sub: sourceMeta[nNote.source].label,
          icon: sourceMeta[nNote.source].icon,
          run: () => onSelectAccount(nNote.accountId),
        }));

    const all = [...actions, ...acc, ...dl, ...tk, ...nt];
    return n ? all.filter((it) => match(it.label) || (it.sub ? match(it.sub) : false)) : all;
  }, [q, accounts, deals, notes, tasks, shareSafe, accountName, onNavigate, onSelectAccount, onTogglePrivacy]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)));
  }, [items.length]);

  if (!open) return null;

  const runActive = () => {
    const item = items[active];
    if (item) {
      item.run();
      onClose();
    }
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center bg-[hsl(224_24%_6%/0.42)] px-3 pt-[10vh] backdrop-blur-[3px] animate-fade sm:px-4 sm:pt-[14vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="flex max-h-[76vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-e3 animate-settle"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            runActive();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "Tab") {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-faint-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search accounts, deals, tasks and notes…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-faint-foreground"
            role="combobox"
            aria-expanded
            aria-controls="cmd-list"
            aria-autocomplete="list"
            aria-activedescendant={items[active] ? `cmd-${items[active].key}` : undefined}
          />
          <Kbd keys={["Esc"]} className="hidden sm:inline-flex" />
        </div>

        <div id="cmd-list" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-3 py-10 text-center text-body-sm text-muted-foreground">No matches for “{q}”</div>
          ) : (
            items.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const Icon = item.icon;
              const selected = i === active;
              return (
                <div key={item.key}>
                  {header && (
                    <div role="presentation" className="px-3 pb-1.5 pt-3 text-label text-faint-foreground first:pt-1.5">
                      {header}
                    </div>
                  )}
                  <button
                    id={`cmd-${item.key}`}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => setActive(i)}
                    onClick={runActive}
                    className={cn(
                      "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors duration-fast",
                      selected ? "bg-foreground/[0.06] text-foreground" : "text-foreground/90",
                    )}
                  >
                    {item.ring != null ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        <Ring value={item.ring} size="xs" showValue={false} label={item.label} className="shrink-0 scale-[0.72]" />
                      </span>
                    ) : Icon ? (
                      <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-foreground" : "text-faint-foreground")} aria-hidden />
                    ) : (
                      <span className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="truncate text-body-sm font-medium">{item.label}</span>
                      {item.sub && <span className="truncate text-label text-faint-foreground">{item.sub}</span>}
                    </span>
                    {selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint-foreground" aria-hidden />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-border bg-surface-sunken/60 px-4 py-2 text-label text-faint-foreground sm:flex">
          <span className="flex items-center gap-1.5">
            <Kbd keys={["↑", "↓"]} />
            Move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd keys={["↵"]} />
            Open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd keys={["⌘", "K"]} />
            Toggle
          </span>
        </div>
      </div>
    </div>
  );
}
