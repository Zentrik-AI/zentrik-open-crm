# Account investigation

User and job: an operator has notes about several accounts, or a set of imported
calls, and wants the CRM to reflect what changed without repeating old facts.
Current failure: classifying quotations still leaves account matching, comparison
and choosing the correct operation to the person.
Must notice first: which account is affected and the actual before/after change.

## Structure selected before implementation

1. Chat transcript: familiar input but decisions disappear into prose. Keep the
   text composer, reject conversation history as the result surface.
2. Free-form animated graph: visually expressive but depends on pan/zoom and
   makes the write target difficult to inspect. Keep a bounded progress path.
3. Single-screen investigation desk: selected. Input on the left, affected
   accounts in the middle, current/proposed changes on the right. Each area
   scrolls independently; the desktop page stays in place. Mobile stacks them.

Design-language alternatives: exempt; preserve the product's editorial type,
paper surface and semantic teal/violet colors. Actual progress changes the UI;
there are no invented thinking messages or simulated production delays.

## Decision contract

Jev first chooses an account from the real account list, or unknown/ambiguous.
For each matched passage it compares active claims and open tasks. Typed choices
propose an added claim, replacement of an existing claim, completion of an
existing task, no change, or clarification. Conditions remain in the evidence.
Conditional or unclear statements cannot complete a task or replace a claim.
Source text is evidence, never an instruction. Provider answers must validate.

The person reviews the before/after change and applies each proposal. Application
uses the existing core operations, writes a source note, preserves history and
checks the account baseline under the workspace lock. A stale account requires a
new investigation. Repeated application cannot duplicate a write.

Input can be pasted or entered with operating-system dictation. The app itself
does not record audio or claim a local speech service. Consent includes selected
notes/transcripts, account names, current claims and open task titles sent to
TypeSafe. No additional provider or generative summary is required.

Proof: mixed-account routing; added/replaced/unchanged/ambiguous outcomes; task
completion; source links; stale and duplicate protection; empty/error/restart;
current notes and imported calls; desktop without page scrolling; mobile and
dark mode. Fixture results are not live model-quality or timing evidence.

## Commands and limits

- `crm calls investigate --file notes.txt --send-to-typesafe`
- `crm calls investigate <call-id> ... --send-to-typesafe`
- `crm calls investigation`
- `crm calls apply-update <run-id> <decision-id> --approved-by "Your name"`
- MCP `crm_investigation` reads the durable plan without a provider call.

Run one investigation at a time. A run accepts up to 50 calls, 1,000 passages,
100 active accounts, and 150 relevant claims/tasks per account. Excess input is
rejected explicitly; it is not silently truncated. Notes and imported calls
use the same decision pipeline. Source sentences retain their exact offsets.
A passage about several accounts is held for clarification.

The comparison includes active claims and open, waiting or completed tasks.
It may recognize a fact already proposed earlier in the same run. That outcome
is labelled as already proposed, not as an existing CRM record. A new run
replaces the previous plan. Each actionable passage proposes one bounded CRM
operation; this is not an exhaustive reconciliation of every related record.

Applying a decision creates a source note and invokes existing core operations.
Claim replacement preserves the previous claim as history. Task completion
records the source-note reference in its completion reason. Repeating a saved
source is recognised without duplicating the change. Stale account records,
older dated sources, conditional completion and uncertain answers cannot be
applied as destructive replacements.

Frontend design review: PASS
- Selected: stationary source, affected-account list, before/after review.
- Reused: semantic tokens, Button/Input/Textarea, account navigation and core
  claim, task and source-note operations.
- Rejected: chat history and a free-form graph; both hid the operation to review.
- Proved: mixed-account text and imported-call investigation; add, replace,
  complete, unchanged and clarification; explicit application; a fixed desktop
  page at 1600×900; 390px layout and dark theme; source offsets, duplicate/stale
  protection, cancellation, invalid provider responses and restart recovery.
- Residual: live Jev routing/decision quality and throughput need real-provider
  rehearsal. Speech uses operating-system dictation; no speech service is added.
