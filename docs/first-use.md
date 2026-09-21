# First Use

Open CRM should prove value before a user connects private systems. A clean
checkout should let someone understand the product loop in one sitting.

## Recommended First Session

1. `npm install`, then `npm run crm -- init ~/crm` and `cd ~/crm && ./crm ui`.
   Add `--demo` to explore synthetic records first.
2. Create the workspace around one real account, or import a backup.
3. Add or inspect the account's contacts.
4. Capture a source note from a recent conversation, support issue, review,
   GitHub issue, or market observation. Record a source reference.
5. Create the next human action.
6. Open the folder in Claude Code, Codex, or Cursor and ask it to run the daily
   review. No API key or connector is required.
7. Watch its proposals arrive under **Review**. Read what grounds each one,
   then approve or reject.
8. See the approved task on the account, carrying the agent's name, its reason,
   and the notes behind it.

The browser-only edition (`npm run dev`) covers steps 2 to 5 with no folder and
offers a one-way Markdown snapshot for agents.

## What A New User Should Learn

- accounts are living records, not static rows
- notes are the source of recommendations
- an agent works the same records through a checked command
- nothing an agent proposes lands until a person approves it
- grounded work looks different from a hunch
- product feedback can become public-safe ideas in Open CRM Buildroom

## What To Avoid In The First Session

- requiring OAuth or private connector setup
- asking users to import their whole CRM before they understand the app
- showing recommendations without evidence
- hiding what an agent will read or infer
- letting an agent's change land unreviewed in a new workspace
- implying that the browser-only snapshot is two-way
- exposing private account data in public Buildroom mode

## Contribution Standard

If a change affects the first-use path, validate that a new local user can still:

- start the app from a clean checkout, in the browser and on a folder
- understand the demo data
- add a local account, contact, and source note
- have an agent propose a change and see it arrive under Review without a reload
- approve it and find it in `workspace.json` and the account's Markdown view
- create a browser snapshot that preserves source references and record ids
