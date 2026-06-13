import type { Account, Task } from "../types";

/** Export tasks as an iCalendar (.ics) feed so they show up in your calendar —
 *  one all-day event per task on its due date. Dependency-free, RFC 5545-ish. */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local Y-M-D of a date, for an all-day DTSTART;VALUE=DATE. */
function icsDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** UTC timestamp for DTSTAMP. */
function icsStamp(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`;
}

function esc(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function tasksToICS(tasks: Task[], accountsById: Map<string, Account>): string {
  const stamp = icsStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zentrik//Open CRM//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Open CRM tasks",
  ];

  for (const t of tasks) {
    const account = t.accountId ? accountsById.get(t.accountId) : undefined;
    const summary = account ? `[${account.name}] ${t.title}` : t.title;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${t.id}@open-crm`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(t.due)}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(`Owner ${t.owner} · ${t.priority} priority`)}`,
      `STATUS:${t.status === "done" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "open-crm-tasks.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
