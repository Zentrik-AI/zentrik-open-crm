# Feedback and support

## What works today

Improve prepares a local draft. **Save local draft** stores only its type, title,
and description in browser storage, separately from CRM records. It does not
create a Zentrik signal, support ticket, workspace membership, or roadmap item.

| Route | Current behavior | Visibility |
| --- | --- | --- |
| Private — keep local | Save one draft in this browser | Local browser storage; not encrypted |
| Public — prepare for GitHub | Review, copy issue text, download JSON, open GitHub manually | File and clipboard stay local until the user shares them |
| Buildroom | Unavailable at verification | No working portal destination offered in Improve |
| Private support | No connected support service in this app | Use a separately verified private channel |

Drafts are shared across workspaces on the same browser origin. Saving replaces
the previous feedback draft. Save before leaving the view. The app reports
storage and clipboard failures instead of claiming success.
**Delete local draft** asks for confirmation and removes only this feedback
draft, not CRM records. Public export validates the same text limits as intake.

## Public handoff and bundle

Select the public route, review the text, and confirm it contains no private
information. Editing any feedback field resets confirmation. Copy and download
remain disabled until the title and description are complete and reviewed.
Changing the sharing choice or reloading the page also clears public review consent.

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
anything. The bundle is not a delivery receipt or a verified hosted API format.

## Buildroom verification and next connection step

The expected URL in [the portal setup guide](../portal/README.md) is
[Open CRM Buildroom](https://open-crm.ideas.zentrik.ai).
On 21 September 2026 it returned HTTP 200 for its HTML shell, but a fresh,
unauthenticated browser rendered **Portal unavailable / Portal not found**.
A successful HTTP response alone does not prove that this portal exists.

The [instance manifest](../portal/open-crm-buildroom.instance.json) specifies
alias `open-crm`, magic-link access, moderation, and an accepted payload label.
These are desired setup values. The setup guide explicitly states that this is
a manifest rather than a migration and that the live schema belongs to the
Zentrik application and portal services. The current service does not provide
the requested public login and moderation behavior. Do not enable the manifest
unchanged or promise hidden-until-reviewed submissions.

The [maintainer intake guide](./self-evolving-loop.md) provides a separate,
reviewed path through Zentrik's external API. It runs outside the browser and
requires a maintainer's configured destination and credential. It is not portal
provisioning, anonymous submission, or automatic delivery. The service owner
must still verify public access and moderation before promoting Buildroom.

Cloud signup, automatic membership, private support intake, votes, signal
ingestion, and release/outcome synchronization are not implemented by this form.

## Sensitive reports

Do not put vulnerabilities, credentials, customer data, private CRM exports,
billing details, or private environment information into public issues.
For security reports, follow the repository's security policy. For other
sensitive support, use a private channel that you have independently verified.
Keeping a local draft does not notify support.
