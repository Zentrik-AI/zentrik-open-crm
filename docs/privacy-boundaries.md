# Privacy Boundaries

This repository is public. Anything committed here is published, including
anything that only survives in history.

## Allowed

- product code
- public documentation
- synthetic fixture data
- public-source research summaries with attribution when needed
- anonymized architecture notes that do not expose private systems
- `.invalid`, `.example`, or `example.com` demo domains

## Not Allowed

- real customer names
- private account records
- private transcripts or meeting notes
- email bodies
- raw support exports
- screenshots containing private data
- API keys, cookies, tokens, or session data
- workspace IDs, production IDs, or private URLs
- private deal amounts tied to real accounts

## Private Workspace Rule

Private workspaces can inform how contributors think about workflows, schema
shape, UI patterns, and operating concepts. They must not be used as data
sources for this public repository.

Do not copy account intelligence, conversations, inbox material, daily checks,
weekly reviews, runtime exports, or workspace setup secrets into this repo.

## Synthetic Data Rule

Synthetic examples should feel realistic but must remain clearly fictitious.
Use invented company names, invented contacts, and safe domains.

Good:

```text
Northstar Robotics
northstar-robotics.invalid
Synthetic call summary
```

Bad:

```text
Any real customer name
Any private customer domain
Any private transcript or meeting note
```

## Agent Review Checklist

Before committing, review staged changes for:

- credentials
- private names
- private domains
- transcripts
- exported JSON
- hidden `.env` or runtime files
- screenshots or binary assets with private content
