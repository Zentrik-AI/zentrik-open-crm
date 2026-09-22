# Security

Do not report vulnerabilities by opening public issues with sensitive details.
Use [GitHub private vulnerability reporting](https://github.com/Zentrik-AI/zentrik-open-crm/security/advisories/new)
for sensitive issues. If the private form is unavailable, contact a maintainer
privately before sharing exploit details.

## Supported Versions

Security fixes target `main` and ship in the next release.

## Data Handling

This repository should contain only code, documentation, and synthetic fixtures.
Never commit:

- API keys or session tokens
- private CRM exports
- customer data
- transcripts or email bodies
- private workspace IDs or production identifiers

The `.gitignore` blocks common private-data folders, but contributors and agents
are responsible for reviewing staged changes before committing.

## Release safety

Before each release, review the the [release checks](./docs/releasing.md),
run the documented checks, and confirm that the release contains only synthetic
fixtures and public-safe documentation.

## Sensitive Issue Triage

If an issue or pull request accidentally includes secrets, private customer
records, private transcripts, private URLs, or production identifiers:

1. Remove public exposure as quickly as possible.
2. Rotate any exposed credential outside this repository.
3. Document the remediation without repeating the sensitive value.
4. Review whether fixtures, screenshots, or exports need stricter guardrails.
