import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Workspace } from "../types";
import { accountRows, sortAccountRows, type AccountRow, type AccountSortKey } from "../core/memory";
import { stageMeta } from "../lib/meta";
import { cn, formatRelative } from "../lib/utils";
import { ArrValue } from "./account-bits";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Private, useShareSafe } from "./ui/privacy";

/**
 * Every account on one grid, sorted by the column you care about today. The
 * list view is for recognizing an account; this is for comparing them. Unknown
 * values stay at the bottom in both directions: reversing a sort should never
 * promote a record we know nothing about.
 */

const columns: Array<{ key: AccountSortKey; label: string; align?: "right"; hint: string }> = [
  { key: "name", label: "Account", hint: "Name" },
  { key: "stage", label: "Stage", hint: "Where the relationship stands" },
  { key: "owner", label: "Owner", hint: "Who holds it" },
  { key: "value", label: "Value", align: "right", hint: "Recorded value plus open pipeline" },
  { key: "lastTouch", label: "Last contact", align: "right", hint: "Last verified interaction" },
  { key: "grounded", label: "Grounded", align: "right", hint: "Active claims that cite a note" },
  { key: "nextDue", label: "Next due", align: "right", hint: "Soonest open task or commitment" },
];

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: (typeof columns)[number];
  sort: { key: AccountSortKey; direction: "asc" | "desc" };
  onSort: (key: AccountSortKey) => void;
}) {
  const active = sort.key === column.key;
  const Icon = sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("border-b border-border px-3 py-2 text-left", column.align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        title={column.hint}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-label uppercase focus-visible:outline-none focus-visible:focus-ring",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          column.align === "right" && "flex-row-reverse",
        )}
      >
        {column.label}
        <Icon className={cn("h-3 w-3 transition-opacity", active ? "opacity-100" : "opacity-0")} aria-hidden />
      </button>
    </th>
  );
}

function Row({ row, selected, onOpen }: { row: AccountRow; selected: boolean; onOpen: () => void }) {
  const shareSafe = useShareSafe();
  const { account } = row;
  const stale = !row.lastTouch;
  return (
    <tr
      className={cn(
        "cursor-pointer border-b border-border transition-colors duration-fast last:border-b-0 hover:bg-muted/60",
        selected && "bg-accent-bg/50",
      )}
      onClick={onOpen}
    >
      <th scope="row" className="max-w-[22ch] px-3 py-2 text-left font-normal">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="truncate rounded-sm text-body text-foreground hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring"
        >
          {account.name}
        </button>
        <div className="truncate text-[11px] text-muted-foreground">{account.segment}</div>
      </th>
      <td className="px-3 py-2">
        <Badge tone={stageMeta[account.stage].tone} dot>
          {stageMeta[account.stage].label}
        </Badge>
      </td>
      <td className="px-3 py-2 text-body-sm text-muted-foreground">{account.owner}</td>
      <td className="px-3 py-2 text-right">
        <ArrValue value={row.value} className="text-[13px]" />
      </td>
      <td
        className={cn("px-3 py-2 text-right font-mono text-[12px] tabular-nums", stale ? "text-warning-fg" : "text-muted-foreground")}
        title={stale ? "Nobody has recorded a verified interaction" : "Last verified interaction"}
      >
        {row.lastTouch ? formatRelative(row.lastTouch) : "unknown"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums">
        {row.claims === 0 ? (
          <span className="text-faint-foreground">none</span>
        ) : (
          <span className={cn(row.grounded === row.claims ? "text-foreground" : "text-muted-foreground")}>
            {row.grounded}/{row.claims}
          </span>
        )}
      </td>
      <td
        className="px-3 py-2 text-right font-mono text-[12px] tabular-nums"
        title={row.nextDue ? (row.overdue > 0 ? `${row.overdue} overdue` : "Next open task or commitment") : undefined}
      >
        {shareSafe ? (
          <Private redactedLabel="hidden">{row.nextDue ?? ""}</Private>
        ) : row.nextDue ? (
          <span className={cn(row.overdue > 0 && "text-destructive-fg")}>{formatRelative(row.nextDue)}</span>
        ) : (
          <span className="text-faint-foreground">nothing open</span>
        )}
      </td>
    </tr>
  );
}

export function AccountTable({
  workspace,
  accounts,
  selectedId,
  onOpen,
}: {
  workspace: Workspace;
  /** The accounts to show, already filtered for archive state. */
  accounts: string[];
  selectedId?: string;
  onOpen: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: AccountSortKey; direction: "asc" | "desc" }>({ key: "lastTouch", direction: "desc" });
  const visible = useMemo(() => new Set(accounts), [accounts]);
  const rows = useMemo(
    () => sortAccountRows(accountRows(workspace).filter((row) => visible.has(row.account.id)), sort.key, sort.direction),
    [workspace, visible, sort],
  );

  function onSort(key: AccountSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "name" || key === "owner" || key === "stage" ? "asc" : "desc" },
    );
  }

  if (rows.length === 0) return <EmptyState title="No accounts to compare." hint="Add an account, or include archived ones." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[720px] border-collapse">
        <caption className="sr-only">
          Accounts, sorted by {columns.find((c) => c.key === sort.key)?.label.toLowerCase()},{" "}
          {sort.direction === "asc" ? "ascending" : "descending"}. Unknown values are listed last.
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <SortHeader key={column.key} column={column} sort={sort} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.account.id} row={row} selected={row.account.id === selectedId} onOpen={() => onOpen(row.account.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
