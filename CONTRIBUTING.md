# Contributing

Zentrik Open CRM welcomes product, design, code, documentation, and integration
contributions.

## Before Contributing

1. Run the app locally and use the workflow you want to improve.
2. Keep account data in examples synthetic and clearly fictitious.
3. Preserve source-grounded behavior. If the app recommends action, it should be
   clear what signal caused that recommendation.
4. Keep new UI consistent with the existing semantic tokens and compact CRM
   workflow style.

## Useful Contribution Types

- product workflow improvements that make daily account work clearer
- better first-use, self-hosting, and local setup documentation
- source-grounding fixes where a recommendation lacks evidence
- privacy improvements, especially around public Buildroom mode
- integrations that have explicit data boundaries and clear setup docs
- tests that protect core CRM flows on desktop and mobile

## Issue Flow

Use the issue template that matches the work:

- bug reports for broken behavior or regressions
- feature requests for product increments
- source-grounding issues when evidence, provenance, or privacy behavior is weak
- good-first-product issues for narrow changes that help new contributors

Describe the user workflow first. Technical suggestions are welcome, but the
maintainer needs to understand the account-work or product-loop problem.

## Pull Request Standard

Every pull request should state:

- what changed
- which user workflow it improves
- whether it touches data handling, privacy, or public Buildroom behavior
- how it was validated

## Local Checks

```bash
npm run typecheck
npm run build
npm run test:e2e
```

## Data Policy

Do not include real customer records, private operating data, API keys, private
transcripts, emails, screenshots, or exports in issues, pull requests, fixtures,
or docs.

Use `.invalid`, `.example`, or `example.com` domains for sample accounts. If a
test needs realistic source material, summarize public information and cite the
source in documentation when needed.
