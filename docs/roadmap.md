# Roadmap

This roadmap keeps the public product direction visible without exposing private
workspace operations.

## Now

- Make the CRM useful from a clean checkout, in the browser and on a folder.
- Keep the agent loop trustworthy: one validated write path, review by default,
  grounded tasks, a visible record of what agents did.
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
- Add connector contracts for email, calendar, support, GitHub, reviews, and
  usage events. Each lands sources as notes with references.
- Add hosted direct submission for Tell Open CRM feedback bundles.
- Add public-safe Buildroom export so accepted ideas can be published cleanly.

## Later

- Add hosted Open CRM Cloud.
- Add workspace teams, roles, and approval flows.
- Add richer account intelligence and market research views.
- Add extension points for custom objects, scoring, and workflows.
- Add agent-run validation reports after product changes.
- Add batch proposals so a multi-step plan is reviewed as one unit.

## Product Bets

- Source-grounded account work should be the main differentiator.
- The first value path should work before private integrations.
- Public product evolution should be visible through Open CRM Buildroom.
- Agent work should feel inspectable and useful, not autonomous in a way users
  cannot trust.
- Self-hosting and local control should remain first-class.

## Non-Goals For Early Releases

- replacing every enterprise CRM customization surface
- optimizing for large sales-admin teams before small technical teams
- adding dashboards that do not change daily account work
- accepting private customer data into public fixtures, docs, or issues
