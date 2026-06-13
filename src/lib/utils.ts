import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Abbreviated currency: $1.2M / $840K. The caller renders the suffix demoted. */
export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Split an abbreviated currency into digits + trailing unit so the unit can be
 *  demoted (muted, smaller) while the digits stay in --foreground. */
export function splitCurrency(value: number): { lead: string; unit: string } {
  const formatted = formatCurrency(value);
  const match = formatted.match(/^([^A-Za-z]*)([A-Za-z]*)$/);
  if (!match) return { lead: formatted, unit: "" };
  return { lead: match[1], unit: match[2] };
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateFull(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Compact relative label: "now", "3h", "2d", "3w", "5mo", "1y" (past)
 *  and "in 3d" (future). Always paired with a full timestamp in a tooltip. */
export function formatRelative(value: string, now: Date = new Date()) {
  const then = new Date(value).getTime();
  const diffMs = then - now.getTime();
  const future = diffMs > 0;
  const abs = Math.abs(diffMs);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  let label: string;
  if (abs < min) label = "now";
  else if (abs < hour) label = `${Math.round(abs / min)}m`;
  else if (abs < day) label = `${Math.round(abs / hour)}h`;
  else if (abs < week) label = `${Math.round(abs / day)}d`;
  else if (abs < month) label = `${Math.round(abs / week)}w`;
  else if (abs < year) label = `${Math.round(abs / month)}mo`;
  else label = `${Math.round(abs / year)}y`;

  if (label === "now") return label;
  return future ? `in ${label}` : label;
}

/** Freshness as a 0..1 value: 1 = brand new, decaying to 0 by `staleDays`. */
export function freshness(value: string, staleDays = 14, now: Date = new Date()) {
  const ageDays = (now.getTime() - new Date(value).getTime()) / (24 * 60 * 60 * 1000);
  return clamp01(1 - ageDays / staleDays);
}

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function clampPct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Initials for a monogram: "Eli Moreno" -> "EM", "Northstar" -> "No". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanize(value: string) {
  return value.replace(/_/g, " ");
}

export function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
