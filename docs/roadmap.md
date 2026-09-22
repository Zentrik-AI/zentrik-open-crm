# Roadmap

This roadmap keeps the public product direction visible without exposing private
workspace operations.

## Now

- Make the CRM useful from a clean checkout, in the browser and on a folder.
- Keep the agent loop trustworthy: one validated write path, review by default,
  grounded tasks and claims, a visible record of what agents did.
- Keep the memory honest: every claim shows its evidence or shows as a hunch;
  the brief and the trace are computed from records, never written by hand.
- Package portable agent setup and opt-in daily/weekly routine contracts.
- Keep unknown scores, source dates and verified contact distinct; protect
  human edits from stale proposals and make repeat runs idempotent.
- Support task maintenance and reversible account archives without losing history.
- Keep demo data synthetic, realistic, and clearly fictitious.
- Keep share-safe mode from leaking private account fields.
- Let local users export feedback bundles and GitHub issue drafts.

## Next

- Publish the `crm` command to npm so setup is one `npx` line.
- Add CSV import for accounts and notes.
- Extend record maintenance to contact and source-note corrections.
- Add more pull-sources playbooks for specific harness integrations, each
  landing files as sources with their external ids.
- Add CSV export alongside the JSON backup.

## Later

- Add workspace teams, roles, and approval flows.
- Add richer account intelligence and market research views.
- Add extension points for custom objects, scoring, and workflows.
- Add agent-run validation reports after product changes.
- Add batch proposals so a multi-step plan is reviewed as one unit.

## Product Bets

- Source-grounded account work should be the main differentiator.
- The first value path should work before private integrations.
- Agent work should feel inspectable and useful, not autonomous in a way users
  cannot trust.
- Self-hosting and local control should remain first-class.

## Non-Goals For Early Releases

- replacing every enterprise CRM customization surface
- optimizing for large sales-admin teams before small technical teams
- adding dashboards that do not change daily account work
- accepting private customer data into public fixtures, docs, or issues
