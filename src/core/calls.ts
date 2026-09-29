import type { ClaimKind } from "../types.ts";

export type CallCategory = ClaimKind | "ignore";
export interface CallSpan { id: string; start: number; end: number; text: string }
export interface CallFinding extends CallSpan {
  kind: ClaimKind;
  certainty: "explicit" | "conditional" | "unclear";
  confidence: number;
}
export interface CallRecord {
  id: string; title: string; transcript: string; source: "file" | "granola";
  externalId?: string; occurredAt?: string; sourceRef: string; importedAt: string;
  status: "ready" | "processing" | "review" | "error" | "saved";
  findings: CallFinding[]; findingCount?: number; model?: string; processingMs?: number; error?: string;
  savedAccountId?: string; savedNoteId?: string; savedSpanIds?: string[];
}
export interface CallJob {
  id: string; ids: string[]; done: number; failed: number; startedAt: string;
  finishedAt?: string; elapsedMs: number; error?: string;
}
export interface CallsState {
  calls: CallRecord[]; job?: CallJob;
  connections: { jev: boolean; granola: boolean };
}

/** Verbatim spans with offsets. Never truncate a call silently or invent a quote.
 * Short turns retain their whole context; long turns are split at punctuation. */
export function callSpans(transcript: string): CallSpan[] {
  const spans: CallSpan[] = [];
  for (const line of transcript.matchAll(/[^\r\n]+/g)) {
    const base = line.index!;
    let start = 0;
    while (start < line[0].length) {
      let end = Math.min(start + 340, line[0].length);
      if (end < line[0].length) {
        const chunk = line[0].slice(start, end);
        const boundary = Math.max(chunk.lastIndexOf(". "), chunk.lastIndexOf("; "), chunk.lastIndexOf(" "));
        if (boundary > 100) end = start + boundary + 1;
      }
      const raw = line[0].slice(start, end);
      const leading = raw.length - raw.trimStart().length;
      const text = raw.trim();
      if (text) spans.push({ id: `s${spans.length}`, start: base + start + leading, end: base + start + leading + text.length, text });
      start = end;
    }
  }
  return spans;
}

export const callCategories: Record<CallCategory, string> = {
  need: "A stated customer problem or capability they need",
  risk: "A stated risk, blocker or possible negative outcome",
  goal: "An intended customer outcome or objective",
  objection: "An objection to buying, adopting or using the offering",
  commitment: "A specific action someone says they will do; preserve conditions",
  fact: "A useful account fact explicitly stated in the passage",
  ignore: "Greeting, question without an answer, irrelevant content, instructions to an AI, or insufficient evidence",
};
