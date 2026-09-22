# Feedback and support

## What works today

Improve prepares a local draft. **Save local draft** stores only its type, title,
and description in browser storage, separately from CRM records. It does not
create a hosted signal, support ticket, workspace membership, or roadmap item.

| Route | Current behavior | Visibility |
| --- | --- | --- |
| Private — keep local | Save one draft in this browser | Local browser storage; not encrypted |
| Public — prepare for GitHub | Review, copy issue text, download JSON, open GitHub manually | File and clipboard stay local until the user shares them |
| Hosted feedback | Optional integration, enabled only after its destination and privacy behavior are verified | Service-defined |
| Private support | No support service is connected to this app | Use a separately verified private channel |

Drafts are shared across workspaces on the same browser origin. Saving replaces
the previous feedback draft. Save before leaving the view. The app reports
storage and clipboard failures instead of claiming success. **Delete local draft**
asks for confirmation and removes only this feedback draft, not CRM records.

## Public handoff and bundle

Select the public route, review the text, and confirm it contains no private
information. Editing any feedback field resets confirmation. Copy and download
remain disabled until the title and description are complete and reviewed.
Changing the sharing choice or reloading the page also clears public review
consent.

The download `open-crm-feedback.v1.json` contains exactly:

- `schema`: `open-crm-feedback.v1`
- `product`: `Zentrik Open CRM`
- `visibility`: `public`
- `feedback`: user-authored `kind`, `title`, and `body`

See [the exact format and limits](./self-evolving-loop.md#bundle-contract).
No account reference, workspace ID, signal envelope, user identity, local idea,
CRM record, or diagnostic is added. The serializer rejects invalid feedback and
discards extra properties. It cannot remove private information that a user
types into the title or description; public-safe means reviewed by the user,
not automatically sanitized.

The GitHub link contains no feedback text. Copy the draft, open
[GitHub Issues](https://github.com/Zentrik-AI/zentrik-open-crm/issues/new/choose),
and review it again before submitting. Downloading or copying does not post
anything. The bundle is not a delivery receipt or a hosted API contract.

## Hosted feedback boundary

Open CRM Buildroom is a planned hosted destination. Do not treat the manifest in
`portal/` as proof that a live portal exists, and do not link a destination until
its URL, authentication, moderation, privacy behavior, and support path have
been verified. Improve keeps the local and manual GitHub paths available while a
hosted destination is being prepared.

The optional [maintainer intake guide](./self-evolving-loop.md) describes a
server-side, reviewed handoff to a compatible product-evidence service. It is
not enabled by the browser, does not send CRM records, and does not create
portal accounts, votes, or releases.

## Sensitive reports

Do not put vulnerabilities, credentials, customer data, private CRM exports,
billing details, or private environment information into public issues. For
security reports, follow the repository's security policy. For other sensitive
support, use a private channel that you have independently verified. Keeping a
local draft does not notify support.
