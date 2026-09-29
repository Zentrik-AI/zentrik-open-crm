# Calls: design decision

User and job: an individual turns selected calls into source-backed account knowledge.
Must notice first: which calls are selected, where processing sends them, and what will be saved.

Structure alternatives:
- Setup wizard: clear first run, but hides the recurring inbox. Retain inline connection setup only.
- Chat panel: flexible, but obscures batch state and exact writes. Reject for this bounded job.
- Calls inbox with detail/review: selected. A list shows progress; the detail shows verbatim evidence and explicit account assignment before saving.

Design language: preserve Open CRM's editorial paper, Fraunces headings, semantic teal selection and violet agent work. Exempt from a new visual language exploration because this extends the established workspace.

Reuse: Button, Field, Select, existing navigation, source registry and core mutation operations. On narrow screens stack list above detail. No modal required to inspect a quote. Share-safe mode suppresses call content and connection inputs entirely.

Cloud boundary: Granola reads use its official API; Jev receives selected transcript passages only after an explicit processing action. Session keys remain in server memory and are never returned by the API or saved to workspace/exports/browser storage.

Review: quotes are copied from source offsets. Model labels and confidence are suggestions. The person chooses an account and individual quotes before committing. Batch processing never bulk-approves claims.

Proof required: import, selection, processing, uncertainty, partial failure, restart recovery, credential clearing, duplicate-save protection, 390px and desktop, light/dark, keyboard input. Live credentials and measured Jev timing must be distinguished from mocked integration checks.

## Outcome review — 2026-09-28

User and job: after a customer call, update an account without losing the words
or conditions that support the update. In a workshop, the audience must see the
account improve before seeing a large batch.
Current failure: import, connections, batch timing, classification metadata and
quote selection compete. The final account is absent from the flow.
Must notice first: the proposed account updates and what approval will add.

Structural alternatives considered before implementation:
1. Analytics dashboard first: supports batch comparison, but counts alone do
   not demonstrate an account change. Retain counts as filters after processing.
2. Question-tree canvas first: makes classification inspectable but requires
   users to navigate a graph before completing their account work. Retain the
   actual questions as optional evidence on an update.
3. Account update review first: selected. Import is a disclosure; the result
   shows proposed knowledge, the target account and a write preview. Completion
   links directly to the updated account. Batch filters answer bounded questions.

Design language: preserve the existing editorial layout, semantic colors and
controls. No new visual identity is needed. Use quiet dividers and a compact
receipt instead of decorative graph nodes or a confidence badge on every quote.

Scope: Jev classification stays the current two-question contract. No new
provider, revenue estimate, automatic deal-stage change or generated summary is
required for this outcome. Counts are calls containing a category, not unique
customers, corroborated facts, revenue, or approved CRM changes. Conditional
statements remain conditional. All claims require individual selection.

Acceptance: import → processing → inspect questions → select update → preview
account change → save → open that account. Verify filtered batch counts,
empty results, no duplicate saves, mobile layout, dark theme and source links.
The existing video represents the earlier interface until replaced.

Frontend design review: PASS
- Outcome: select evidence, preview additions, save, then open the account.
- Selected: account update review; existing account navigation, source notes,
  claim operations, semantic controls and editorial design.
- Rejected: dashboard first and graph first; both delayed the account outcome.
- Subtracted: permanent import controls, decorative evidence-map badges,
  repeated confidence metadata and the completed batch progress frame.
- Proved: synthetic Granola import through saved account, question disclosure,
  filtered category counts and matching passages, empty filters, 390px layout,
  dark theme, provider error, 50-call processing and source/key boundaries.
- Validation: typecheck, unit suite, production build, package smoke, full
  browser suite (25 passed, 10 device-specific skips) and Calls flow passed.
- Residual: deterministic provider tests and labelled rehearsal video do not
  validate live provider quality, availability or throughput.
