# Contributing

Zentrik Open CRM welcomes product, design, code, documentation, and integration
contributions.

Before contributing:

1. Run the app locally and use the workflow you want to improve.
2. Keep account data in examples synthetic and clearly fictitious.
3. Preserve source-grounded behavior. If the app recommends action, it should be
   clear what signal caused that recommendation.
4. Keep new UI consistent with the existing semantic tokens and compact CRM
   workflow style.

## Local Checks

```bash
npm run typecheck
npm run build
```

## Data Policy

Do not include real customer records, private operating data, API keys, private
transcripts, emails, screenshots, or exports in issues, pull requests, fixtures,
or docs.
