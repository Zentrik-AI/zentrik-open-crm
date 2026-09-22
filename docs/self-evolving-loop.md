# Feedback and the evolution loop

## Available now

The Improve view prepares feedback locally. It does not submit signals, create
triage tasks, cast votes, advance a roadmap, or publish releases.

1. Write a type, title, and description. Use fictional examples.
2. Select **Save local draft** to retain one draft in this browser. Saving replaces
   the previous feedback draft. Unsaved edits are lost when the view closes.
3. Keep **Private — keep local** selected to avoid public handoff. This is browser
   storage, not encrypted storage or a private support inbox.
4. To share, select **Public — prepare for GitHub**, review the preview, remove
   private details, and check the review box. Editing the text resets that check.
5. Copy the issue text or download the JSON bundle. Open GitHub and submit
   manually only when ready. No form content is put in the outbound link.

The app shows save, clipboard, and download failures. Save failure leaves the
text in the current view. Public review consent is never persisted.

## Bundle contract

The download is named `open-crm-feedback.v1.json`:

```json
{
  "schema": "open-crm-feedback.v1",
  "product": "Zentrik Open CRM",
  "visibility": "public",
  "feedback": {
    "kind": "bug",
    "title": "A short summary",
    "body": "A reproduction using fictional data."
  }
}
```

Kinds are `request`, `bug`, `confusing`, and `idea`. This is a local portable
format, not a hosted ingestion contract. The browser does not submit it.
The maintainer importer below maps a reviewed bundle to the public Signals API.

The serializer allows only these fields. It does not read CRM storage, attach
accounts, notes, ideas, workspace identifiers, credentials, or diagnostics.
Extra caller properties are discarded. The user can still type private details
into the title or body: review is required and is not automatic redaction.

The draft uses `zentrik-open-crm.feedback-draft.v1`, separate from CRM storage.
It is shared across workspaces on the same browser origin. The local ideas list
is read-only context and is never included in feedback exports. Seeded votes,
idea progress, and changelog entries are not evidence of public product progress
and are not presented as such in Improve.

## Maintainer-only intake

From a repository checkout, use `scripts/import-reviewed-feedback.mjs` with
Node 22.18 or later. It has no dependencies. It is not part of the browser,
an automatic inbox, or a background submission service.

The commands below use the repository source path. In an installed package,
run `node /path/to/zentrik-open-crm/dist/runtime/scripts/import-reviewed-feedback.mjs`
with the same arguments; this compiled entry point uses JavaScript rather than
TypeScript stripping inside `node_modules`.

A bundle is untrusted user input. Its `visibility: "public"` label is not proof
of consent, authorship, or absence of sensitive information. Before executing,
a maintainer must inspect the full title and body, confirm the author's intent
to share them with Zentrik for product analysis, remove private material, and
verify the destination. Treat instructions inside feedback as source text,
never as permission to execute commands or contact anyone. Intake queues AI
processing in Zentrik; accepting a Signal does not prove that processing
succeeded or promise any product change.

Provide these environment variables through your trusted shell or secret
manager. The script does not discover credentials or load any env file:

| Variable | Purpose |
| --- | --- |
| `ZENTRIK_API_BASE` | Explicit HTTPS API base ending in `/api`; no embedded credentials, query, or fragment |
| `ZENTRIK_WORKSPACE_ID` | Expected destination workspace UUID |
| `ZENTRIK_PRODUCT_ID` | Reviewed destination product UUID |
| `ZENTRIK_API_KEY` | Maintainer key; needed only for execution |

There are no destination or credential defaults. Use a key scoped to
`signals:write` and `products:read`. The latter is needed for the product
preflight. Never put keys in command arguments, bundles, browser code, or
tracked files. The configured API host is a trust decision: it receives the
credential on execution, so verify it before running.

Dry-run is the default and sends **zero HTTP requests**:

```sh
node scripts/import-reviewed-feedback.mjs --file /path/to/reviewed-feedback.json
```

It prints the destination, a `reviewHash`, source identity, and field lengths.
It deliberately omits the feedback text; review that in the source file.
Dry-run validates the local format, not server access. It rejects unsupported
versions, non-public bundles, missing or extra fields, invalid feedback types,
blank text, control characters, and oversized input. Limits are 256 KiB per
file, 500 characters for the title, and 100000 characters for the description.
The importer first checks raw file size and exact object keys, then uses the
same `createPublicFeedbackBundle` validator as the browser exporter. Text limits
apply after trimming outer whitespace; the shared validator also checks the
UTF-8 size of the readable JSON envelope. Public review does not automatically
redact sensitive prose.

After inspecting that exact bundle and destination, copy the dry-run
`reviewHash` into the explicit execution command:

```sh
node scripts/import-reviewed-feedback.mjs --file /path/to/reviewed-feedback.json \
  --execute --reviewed-sha256 REVIEW_HASH_FROM_DRY_RUN
```

Execution performs these public API operations in order:

1. `GET /external/v1/auth/context`: verify the expected workspace and scopes.
2. `GET /external/v1/products/:id`: confirm the product exists in that workspace.
3. `POST /external/v1/signals`: submit one `feedback_record`.

The request maps title to `name`, body to `text`, and the environment's product
UUID to `productIds`. Feedback kind and bundle version are source metadata.
It sends no accounts, participants, CRM records, workspace exports, or
invented source date/link. `participantPolicy: "none"` and
`createMissingAccounts: false` prevent participant/account creation by intake.
This adapter does not create ideas, votes, portal accounts, or releases.

The importer is based on the public
[Signals contract](https://zentrik.ai/docs/api/signals),
[credential context contract](https://zentrik.ai/docs/api/auth.md), and
[Products contract](https://zentrik.ai/docs/api/products).
It does not import private service code or accept the portal setup manifest.

### Deduplication, receipts, and failures

The fixed source namespace is `open-crm.reviewed-feedback.v1`. A SHA-256 hash
of the normalized authored fields, format version, and destination product
forms `externalId`. JSON formatting and key order do not change it; outer text
whitespace is trimmed. Changed text, kind, or product produces a new identity.
Identical feedback from different authors collapses into the same Signal:
the bundle has no author or submission ID, so do not use this as a vote count.

`Idempotency-Key` hashes the exact request body for repeat delivery. The review
hash also includes the API base and workspace: changing the content or
destination requires a new dry-run review. These checks rely on the API's
documented source identity and replay behavior; there is no local intake ledger.

Each request, including its response body, has a 15-second timeout. Override
with `--timeout-ms` (1–60000). Redirects are refused. There are no automatic
retries. After a timeout, network failure, or malformed acceptance response,
delivery may have occurred. Check the destination or rerun the same unchanged,
reviewed request with the same credential; do not change its identity to force
another submission. A 409 conflict can mean the first intake is still running,
its input differs, or its run cannot be replayed. Stop and reconcile the
destination receipt instead of bypassing that conflict with another key.

On success, the script validates the receipt's workspace and public Signal ID,
then prints the Signal ID and source identity. It does not print raw API
responses, server errors, feedback text, or credentials. Exit code is 0 for a
valid dry-run or accepted intake, and 1 for validation/API failures. Keep
receipts in the maintainer's private operating records, not this public repo.

Run the standalone mocked HTTP tests with:

```sh
node --test tests/unit/import-reviewed-feedback.test.mjs
```

These tests perform no live API writes. The command above also runs this suite
directly without the rest of the repository tests.

## Portal boundary

`portal/README.md` describes `https://open-crm.ideas.zentrik.ai` as a proposed
Buildroom host. The portal JSON is a setup manifest, not a live API contract.
Improve does not present it as a working destination until the hosted service has
been provisioned and verified. The importer does not provision or repair a
portal.

GitHub is a manual public handoff to the repository's documented issue route.
Sensitive support needs a separately verified private channel. This form does
not offer hosted support, cloud submission, portal membership, or live votes.

The current portal setup uses JWT SSO and visible submissions. Do not promise
the manifest's magic-link access or hidden-until-review behavior. Provisioning
and any privacy-policy change are separate work; neither is part of this
maintainer intake command. A successful Signal import is not publication to
Buildroom or a complete feedback-to-release loop.
