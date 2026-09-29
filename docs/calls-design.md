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
