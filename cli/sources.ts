import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { OpError } from "../src/core/ops.ts";

/**
 * Durable sources. A file the person or an agent brings in (a transcript, an
 * email export, a calendar event, a ticket) is copied under `sources/` by its
 * content hash and listed in `sources/index.json`. Notes cite it as
 * `source:<id>`, so a trace can always reach the original, and the same file
 * brought in twice is the same source.
 */

export const SOURCES_DIR = "sources";
const INDEX = "index.json";
export const sourceKinds = ["transcript", "email", "calendar", "ticket", "export", "document"] as const;
export type SourceKind = (typeof sourceKinds)[number];

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  /** Where the file lives, relative to the workspace folder. */
  path: string;
  sha256: string;
  bytes: number;
  originalName: string;
  /** Identity in the system it came from, when known: a message id, event id, ticket number. */
  externalId?: string;
  occurredAt?: string;
  capturedAt: string;
  capturedBy: string;
}

function indexPath(dir: string) {
  return path.join(dir, SOURCES_DIR, INDEX);
}

export function readSources(dir: string): SourceRecord[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath(dir), "utf8")) as { sources?: SourceRecord[] };
    return Array.isArray(parsed.sources) ? parsed.sources : [];
  } catch {
    return [];
  }
}

function writeSources(dir: string, sources: SourceRecord[]) {
  fs.mkdirSync(path.join(dir, SOURCES_DIR), { recursive: true });
  const file = indexPath(dir);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ schema: "open-crm-sources.v1", sources }, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function findSource(dir: string, ref: string): SourceRecord | undefined {
  const id = ref.replace(/^source:/, "").trim();
  return readSources(dir).find((s) => s.id === id || s.externalId === id || s.sha256.startsWith(id));
}

/** Bring a file in. The same content, or the same external id, is the same source. */
export function addSource(
  dir: string,
  file: string,
  options: { kind?: string; externalId?: string; occurredAt?: string; capturedBy: string; move?: boolean },
): { source: SourceRecord; existed: boolean } {
  const kind = (options.kind ?? "document") as SourceKind;
  if (!sourceKinds.includes(kind)) throw new OpError("invalid_value", `--kind must be one of: ${sourceKinds.join(", ")}.`);
  const from = path.resolve(file);
  let data: Buffer;
  try {
    data = fs.readFileSync(from);
  } catch {
    throw new OpError("not_found", `Cannot read ${file}.`);
  }
  if (data.byteLength > 25 * 1024 * 1024) throw new OpError("invalid_value", "Keep a source under 25 MB; link larger files by reference instead.");
  const sha256 = createHash("sha256").update(data).digest("hex");
  const sources = readSources(dir);
  const existing = sources.find((s) => s.sha256 === sha256 || (options.externalId && s.externalId === options.externalId));
  if (existing) return { source: existing, existed: true };

  const id = `src_${sha256.slice(0, 10)}`;
  const ext = path.extname(from).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 8);
  const rel = path.join(SOURCES_DIR, `${id}${ext}`);
  fs.mkdirSync(path.join(dir, SOURCES_DIR), { recursive: true });
  fs.copyFileSync(from, path.join(dir, rel));
  if (options.move && !path.relative(path.join(dir, SOURCES_DIR), from).startsWith("..") === false) fs.rmSync(from, { force: true });
  const source: SourceRecord = {
    id,
    kind,
    path: rel,
    sha256,
    bytes: data.byteLength,
    originalName: path.basename(from),
    externalId: options.externalId?.trim() || undefined,
    occurredAt: options.occurredAt,
    capturedAt: new Date().toISOString(),
    capturedBy: options.capturedBy,
  };
  writeSources(dir, [...sources, source]);
  return { source, existed: false };
}
