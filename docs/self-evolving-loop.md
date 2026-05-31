# Self-Evolving Loop

Zentrik Open CRM should be useful as a CRM and legible as a product that improves
with its users.

The loop is:

1. A user runs the CRM and hits friction, sees a missing workflow, reports a bug,
   votes on a public request, or answers an outcome check.
2. The product captures that as source-grounded signal.
3. Zentrik links the signal to account context, product area, insights,
   opportunities, and ideas.
4. Agents prepare product work from the linked evidence.
5. Humans review product-defining or customer-facing decisions.
6. A release ships through the public repository.
7. The product asks whether the release helped.
8. Public-safe status appears in Open CRM Buildroom.

## Feedback Modes

Open CRM should support three user-facing feedback modes.

### Private Signal

Best for rough, contextual, or sensitive feedback.

The user can describe what happened without worrying about public visibility.
Zentrik receives a signal that can later become an insight or strengthen an
existing opportunity.

### Buildroom Request

Best for public feature requests and workflow problems the user wants others to
see, vote on, or refine.

The request should become a public-safe idea candidate only after moderation.
Votes and rankings help quantify interest, but they should not override product
judgment.

### GitHub Issue

Best for reproducible bugs, self-hosting failures, source-grounding defects, and
implementation-ready contributor work.

GitHub should remain the public engineering record. Zentrik should still ingest
issues as signal so product decisions do not get split across systems.

## Product Rule

Do not force users to understand Zentrik internals. The product should explain:

- what will be private
- what can become public
- what evidence an agent will use
- what changed because of the feedback
- whether a release actually solved the problem

## First Implementation Shape

The local app should first prove the loop without external services:

- create a private signal from feedback
- create an idea candidate for Buildroom or GitHub-shaped feedback
- create a Codex triage task from the idea
- record an evolution-log entry
- keep the user aware of the public/private boundary

Hosted and connected installations can later send the same envelope directly to
Zentrik and Open CRM Buildroom.
