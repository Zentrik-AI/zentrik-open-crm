import type { Account, Contact, Deal, Note, Task } from "../types";
import { formatDate, splitCurrency } from "./utils";
import { sourceMeta } from "./meta";

/**
 * Bring-your-own-key Claude integration. The key is stored only in this
 * browser's localStorage and sent directly to the Anthropic API — it never
 * touches a Zentrik server (this is a local-first app).
 */

const AI_STORAGE_KEY = "zentrik-open-crm.ai.v1";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export type AiModel = "claude-opus-5" | "claude-sonnet-5" | "claude-haiku-4-5";

export const aiModels: Array<{ id: AiModel; label: string; note: string }> = [
  { id: "claude-opus-5", label: "Claude Opus 5", note: "Most capable" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Balanced" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "Fastest, cheapest" },
];

export interface AiSettings {
  apiKey: string;
  model: AiModel;
}

const emptyAiSettings: AiSettings = { apiKey: "", model: "claude-opus-5" };

export function loadAiSettings(): AiSettings {
  if (typeof window === "undefined") return emptyAiSettings;
  try {
    const raw = window.localStorage.getItem(AI_STORAGE_KEY);
    if (!raw) return emptyAiSettings;
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      apiKey: parsed.apiKey ?? "",
      // A saved model that is no longer offered falls back to the default.
      model: aiModels.some((m) => m.id === parsed.model) ? (parsed.model as AiModel) : emptyAiSettings.model,
    };
  } catch {
    return emptyAiSettings;
  }
}

export function saveAiSettings(settings: AiSettings) {
  try {
    window.localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* localStorage may be unavailable */
  }
}

export const hasAiKey = (s: AiSettings) => s.apiKey.trim().length > 0;

/** Mask a key for display: sk-ant-…last4. */
export function maskKey(key: string) {
  const k = key.trim();
  if (k.length < 12) return k ? "•".repeat(k.length) : "";
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}

export class AiError extends Error {}

/** One non-streaming Messages API call, direct from the browser. */
async function callClaude(opts: {
  settings: AiSettings;
  system: string;
  prompt: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const key = opts.settings.apiKey.trim();
  if (!key) throw new AiError("Add an Anthropic API key in Settings to use AI features.");

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        // Opt in to direct browser access (the API is CORS-gated without this).
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: opts.settings.model,
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new AiError("Couldn't reach the Anthropic API. Check your network connection.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? "";
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new AiError("That API key was rejected. Check it in Settings.");
    if (res.status === 429) throw new AiError("Rate limited by Anthropic. Wait a moment and retry.");
    if (res.status === 529) throw new AiError("Anthropic is briefly overloaded. Retry in a moment.");
    throw new AiError(detail || `Anthropic API error (${res.status}).`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new AiError("The model returned an empty response.");
  return text;
}

/* ---- Grounding ---------------------------------------------------------- */

function accountContext(account: Account, notes: Note[], deals: Deal[], tasks: Task[]) {
  const recentNotes = notes.slice(0, 8);
  const noteBlock = recentNotes.length
    ? recentNotes
        .map(
          (n) =>
            `- [${sourceMeta[n.source].label} · ${formatDate(n.createdAt)} · ${n.sentiment}] ${n.title}\n  ${n.body}`,
        )
        .join("\n")
    : "- (no notes captured yet)";
  const dealBlock = deals.length
    ? deals
        .map((d) => `- ${d.name} — ${d.stage}, ${splitCurrency(d.value).lead}${splitCurrency(d.value).unit}, ${d.probability}% (close ${formatDate(d.closeDate)})`)
        .join("\n")
    : "- (no deals)";
  const openTasks = tasks.filter((t) => t.status === "open");
  const taskBlock = openTasks.length
    ? openTasks.map((t) => `- ${t.title} (due ${formatDate(t.due)}, ${t.priority})`).join("\n")
    : "- (no open tasks)";

  return [
    `ACCOUNT: ${account.name} — ${account.segment}`,
    `Stage: ${account.stage} · Priority: ${account.priority} · Health: ${account.health}/100 · Fit: ${account.fit}/100 · Owner: ${account.owner}`,
    `Needs:\n${account.needs.map((n) => `- ${n}`).join("\n")}`,
    `Risks:\n${account.risks.map((r) => `- ${r}`).join("\n")}`,
    `Open deals:\n${dealBlock}`,
    `Open tasks:\n${taskBlock}`,
    `Recent notes (newest first):\n${noteBlock}`,
  ].join("\n\n");
}

const GROUNDING_SYSTEM =
  "You are an assistant inside a source-grounded CRM. You only use the account context provided — never invent customer names, facts, numbers, commitments, or pricing that aren't in the context. Ground every claim in the notes, deals, or tasks given. A human will review and approve before anything is sent. Be concise, specific, and useful. If the context is thin, say what's missing rather than guessing.";

/** A short, evidence-grounded account brief. */
export function generateAccountBrief(
  settings: AiSettings,
  ctx: { account: Account; notes: Note[]; deals: Deal[]; tasks: Task[] },
  signal?: AbortSignal,
) {
  const prompt = [
    accountContext(ctx.account, ctx.notes, ctx.deals, ctx.tasks),
    "",
    "Write a tight account brief with these sections (use short markdown headers):",
    "**Where things stand** — 2-3 sentences on the relationship and momentum.",
    "**What they need** — the 2-3 most important needs, each tied to a specific note.",
    "**Risks** — what could stall or lose this, grounded in the notes.",
    "**Recommended next step** — one concrete action, and why now.",
    "Keep it under ~180 words. Cite the evidence inline (e.g. \"per the 6/10 call\").",
  ].join("\n");
  return callClaude({ settings, system: GROUNDING_SYSTEM, prompt, maxTokens: 900, signal });
}

/** A draft follow-up email grounded in the account's recent notes. */
export function generateFollowUp(
  settings: AiSettings,
  ctx: { account: Account; notes: Note[]; deals: Deal[]; tasks: Task[]; contact?: Contact },
  signal?: AbortSignal,
) {
  const to = ctx.contact ? `${ctx.contact.name} (${ctx.contact.role})` : "the primary contact";
  const prompt = [
    accountContext(ctx.account, ctx.notes, ctx.deals, ctx.tasks),
    "",
    `Draft a short, warm follow-up email to ${to}. It must:`,
    "- Reference the most recent specific conversation or blocker by name (not generically).",
    "- Move exactly one thing forward (tie it to an open task or the next deal step).",
    "- Sound like a real person, not a template. No buzzwords, no filler.",
    "Return just the email: a Subject line, then the body. Under ~150 words.",
  ].join("\n");
  return callClaude({ settings, system: GROUNDING_SYSTEM, prompt, maxTokens: 700, signal });
}

/** Answer a free-form question, grounded strictly in this account's context. */
export function generateAnswer(
  settings: AiSettings,
  ctx: { account: Account; notes: Note[]; deals: Deal[]; tasks: Task[] },
  question: string,
  signal?: AbortSignal,
) {
  const prompt = [
    accountContext(ctx.account, ctx.notes, ctx.deals, ctx.tasks),
    "",
    `Question: ${question}`,
    "",
    "Answer using only the account context above. Cite the specific note/deal/task you're drawing from. If the answer isn't in the context, say so plainly and suggest what to capture. Keep it under ~140 words.",
  ].join("\n");
  return callClaude({ settings, system: GROUNDING_SYSTEM, prompt, maxTokens: 700, signal });
}

/** A lightweight connection test. */
export function testConnection(settings: AiSettings, signal?: AbortSignal) {
  return callClaude({
    settings,
    system: "Reply with exactly: ok",
    prompt: "Connection test. Reply with the single word: ok",
    maxTokens: 16,
    signal,
  });
}
