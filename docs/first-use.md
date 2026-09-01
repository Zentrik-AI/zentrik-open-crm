# First Use

Open CRM should prove value before a user connects private systems. A clean
checkout should let someone understand the product loop in one sitting.

## Recommended First Session

1. Run the app locally.
2. Create a local workspace around one account, import a backup, or choose the
   synthetic demo.
3. Use the Home checklist to confirm the account is ready.
4. Add or inspect the account's contacts.
5. Capture a source note from a recent account conversation, support issue,
   review, GitHub issue, or market observation. Record a source reference when
   one is available.
6. Open the account detail page and confirm the signal changes account memory.
7. Create the next human action.
8. Open **Settings → Agent workspace** and create a Markdown snapshot in a
   private folder.
9. Open Codex, Claude Code, or another file-capable agent in that folder. Copy
   the starter request and review the cited evidence before accepting its work.
10. Record the accepted action in the visual CRM, then sync again. Export the
    local workspace as JSON when it should be backed up or moved.

## What A New User Should Learn

- accounts are living records, not static rows
- signals are the source of recommendations
- agent work is prepared from explicit context
- browser data reaches CLI agents only through an explicit private snapshot
- humans approve meaningful action
- product feedback can become public-safe ideas in Open CRM Buildroom

## What To Avoid In The First Session

- requiring OAuth or private connector setup
- asking users to import their whole CRM before they understand the app
- showing recommendations without evidence
- hiding what an agent will read or infer
- implying that agent edits update the browser CRM automatically
- exposing private account data in public Buildroom mode

## Contribution Standard

If a change affects the first-use path, validate that a new local user can still:

- start the app from a clean checkout
- understand the demo data
- add a local account and contact
- add a signal
- inspect an account
- copy an agent prompt
- create an agent-readable snapshot that preserves source references
- understand the sync → review → apply loop
- see how signals connect to ideas and releases
