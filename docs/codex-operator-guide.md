# Codex operator guide

Setup, the review loop, and the operating contract live in the
[Agent Operator Guide](./agent-operator-guide.md). They also apply to Claude
Code, Cursor, and other agents that can work with files and a shell.

Codex reads `AGENTS.md` from the workspace folder and can run `./crm` directly.
To expose the MCP tools, run this command from the workspace folder:

```bash
codex mcp add open-crm -- ./crm mcp
```

Agent changes are recorded under an actor name. Set `OPEN_CRM_ACTOR` when a
different name is useful for a team audit.

## Safe handoff

Keep the workspace folder separate from this source repository when it contains
real account data. Give an agent only the files and records needed for the task.
It may inspect the explicit snapshot, research within the stated boundary,
prepare proposals, edit repository files when asked, run validation, and report
evidence. A person retains authority over customer communication, privacy,
publication, and other external changes.

The default workflow is:

1. Run `./crm status` and read the workspace operating instructions.
2. Read the account or source records relevant to the request.
3. Propose a bounded note, task, or account change with evidence.
4. Review the proposal in the app before it lands.
5. Run validation and report what changed, what did not, and what remains open.

Do not put real account records, credentials, or private transcripts into this
public source repository. See [Privacy boundaries](./privacy-boundaries.md).
