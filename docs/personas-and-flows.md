# Personas and flows

Who Open CRM is for, the moments it is built around, and what each surface
must make obvious first. Product and design decisions are judged against this
page; when a change does not serve one of these flows, it is probably bloat.

## People

- **The founder who sells.** Runs a handful of live relationships beside
  everything else. Wants to walk into a call knowing what was said last time,
  what was promised, and what to ask. Has no time to maintain records.
- **The consultant or agency lead.** Many accounts, several people at each.
  Needs to know who decides, which relationships are going cold, and what each
  side owes. Loses deals to a missing economic buyer more than to price.
- **The builder or operator.** Runs a small B2B product. Wants signals from
  calls, support, reviews, and usage to become account memory and, over time,
  product decisions. Prefers a folder and a command to a hosted admin panel.
- **The agent.** Claude Code, Codex, Cursor, or a scheduled routine working
  the same folder. Reads the contract, captures sources, records what they
  support, proposes actions. Never decides, never sends.

## Flows to maximize

1. **What needs me today.** Home and `crm status`: due work, overdue
   commitments, accounts going quiet, what agents are waiting on.
2. **Before a conversation.** The account's *Before you talk to them* card and
   `crm brief`: what changed since the last real contact, what we owe and are
   owed, who decides and who is missing, what to ask. Under five minutes.
3. **After a conversation.** Capture the source as a note, then record what it
   supports as claims and the next action, each citing the note. An agent can
   do this from the inbox; a person approves.
4. **Knowing why.** From any task, claim, or note, open the trace: source,
   what we took from it, what it led to. Hunches look different from grounded
   facts everywhere they appear.
5. **Reviewing agent work.** Review: each proposal with its evidence, approved
   in order, nothing landing until a person decides.
6. **Weekly.** The Book and `crm lint`: every account by stage with the one
   thing worth noticing; where the memory is thin, which commitments slipped,
   which accounts have no one who signs off. When the question is a comparison
   rather than a judgement, Accounts has a sorted table of the same records.
7. **When it becomes product work.** The Book's patterns show what several
   accounts are saying. The handoff to Zentrik carries the sources; the
   decision is made there, not here.

## What each surface must make obvious first

| Surface | First thing noticed |
| --- | --- |
| Home | The one overdue thing, and whether an agent is waiting on you |
| Book | The lane with the most accounts needing something, and what several accounts are saying |
| Account | What changed since you last spoke, and the question to lead with |
| Table | The column you came to compare, with unknowns at the bottom |
| What we know | Which lines are grounded and which are hunches |
| Who decides | Which lane is empty |
| Review | What the change is and what grounds it, then Approve |
| Trace | The source, then the chain |
| `crm brief` | Same as the account, in text an agent can read |

## Non-goals

- Dashboards that do not change what someone does today.
- A global graph view. Local, typed traces answer real questions; a hairball
  does not.
- Product roadmapping inside the CRM. Recurrence is surfaced and handed on;
  the decision belongs in a product tool.
- Bundled connectors with their own OAuth. The person's harness already
  reaches their systems; the CRM keeps what it brings in.
- Automatic sending, automatic stage changes, or inferred intent from silence.
