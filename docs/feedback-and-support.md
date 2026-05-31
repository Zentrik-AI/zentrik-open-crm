# Feedback And Support

Open CRM should collect user signal without forcing every user into the same
channel. Use the channel that matches the privacy and workflow.

## Channels

| Channel | Use For | Visibility | Zentrik Signal |
| --- | --- | --- | --- |
| Tell Open CRM | Contextual product feedback while using the CRM | Private by default | In-app feedback bundle or hosted signal |
| Open CRM Buildroom | Public requests, votes, release status, outcome checks | Public after moderation | Portal submission, vote, and idea link |
| GitHub Issues | Reproducible bugs, setup failures, source-grounding defects, contributor work | Public | Issue backlink plus signal envelope |
| Support Request | Hosted-account problems, private setup help, sensitive troubleshooting | Private | Support signal and triage task |
| Security Reporting | Vulnerabilities or sensitive exposure | Private | Security process, not public product feedback |

GitHub is required for open-source trust and contributor workflows, but it should
not become the only product system. Buildroom is the public product loop.
Zentrik is the product memory that links all channels into evidence, ideas,
agent work, releases, and outcome checks.

## Joining The Workspace

Users should be able to join the Open CRM Buildroom in three ways:

1. **Cloud signup**: after account creation, offer an opt-in magic-link invite
   to the Open CRM Buildroom with an `Open CRM member` role.
2. **Local or self-hosted app**: show the Buildroom link from Tell Open CRM and
   launch surfaces. Local users can also download a feedback bundle.
3. **GitHub contributors**: link the Buildroom from issue templates and launch
   docs so contributors can see public product context before filing issues.

Workspace access must never expose private CRM account records, raw support
messages, customer names, transcripts, emails, credentials, private workspace
IDs, or internal prioritization notes.

## Feedback Bundle

Local and self-hosted users need a portable artifact because their app may not
be connected to Zentrik. The app exports an `open-crm-feedback.v1` bundle after a
Tell Open CRM submission.

The bundle includes:

- stable `externalId`
- source, source facet, source label, and privacy mode
- product: `Zentrik Open CRM`
- workflow area and feedback type
- public/private routing instruction
- linked local account reference
- a Zentrik signal envelope
- optional GitHub issue draft

Agents can import the bundle into the Zentrik Open CRM workspace, create or link
ideas, and preserve provenance without scraping free-form text.

## GitHub Usage

Use GitHub for public, reproducible work:

- bugs and regressions
- setup or self-hosting failures
- source-grounding and privacy defects
- implementation-ready feature requests
- contributor tasks

Do not use GitHub for private account data, private CRM exports, hosted account
support, vulnerabilities, billing, credentials, or confidential customer
context.

## Support Usage

Use support requests for private operational help:

- cloud account access
- invite or Buildroom membership problems
- setup issues that include private environment details
- data/privacy questions
- cases where the user cannot safely publish reproduction details

Support records can still become product signal after private details are
summarized and linked safely.
