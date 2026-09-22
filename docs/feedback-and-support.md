# Feedback and support

**Improve** prepares feedback about Open CRM itself. It never reads your CRM
records, and it never sends anything on its own.

| Route | What happens | Where it goes |
| --- | --- | --- |
| Private — keep local | One draft is saved in this browser | Local browser storage, not encrypted |
| Public — prepare for GitHub | Review the text, copy the issue or download the bundle, submit it yourself | Nothing leaves your machine until you submit it |
| Private support | No support service is connected to this app | Use a channel you have verified yourself |

Drafts are shared across workspaces on the same browser origin, and saving
replaces the previous draft. The app reports storage and clipboard failures
instead of claiming success. **Delete local draft** asks for confirmation and
removes only the feedback draft, never CRM records.

## The public bundle

Choose the public route, read the preview, and confirm it contains nothing
private. Editing any field resets that confirmation; so does changing the
sharing choice or reloading the page. Copy and download stay disabled until the
title and description are complete and reviewed.

`open-crm-feedback.v1.json` contains exactly:

```json
{
  "schema": "open-crm-feedback.v1",
  "product": "Zentrik Open CRM",
  "visibility": "public",
  "feedback": { "kind": "bug", "title": "A short summary", "body": "A reproduction using fictional data." }
}
```

Kinds are `request`, `bug`, `confusing`, and `idea`. The serializer allows only
those fields: no account reference, workspace id, user identity, CRM record, or
diagnostic is added, and extra properties are discarded. Limits are 500
characters for the title and 100,000 for the body.

It cannot remove private information you type into the title or body.
Public-safe means *you reviewed it*, not that it was sanitized for you.

The GitHub link carries no feedback text. Copy the draft, open
[GitHub Issues](https://github.com/Zentrik-AI/zentrik-open-crm/issues/new/choose),
and read it once more before submitting.

## Sensitive reports

Keep vulnerabilities, credentials, customer data, CRM exports, and billing
details out of public issues. For security, follow
[SECURITY.md](../SECURITY.md). Saving a local draft notifies no one.
