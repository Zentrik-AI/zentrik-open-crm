# Open CRM Buildroom manifest

This directory contains a proposed configuration for a public feedback space
around Zentrik Open CRM. The manifest is portable input for a compatible hosted
service. It is not a live portal, an API contract, or proof that the proposed
host is available.

The proposed name is **Open CRM Buildroom**, with the alias `open-crm` and the
host currently reserved as:

```text
https://open-crm.ideas.zentrik.ai
```

Before linking this address from a product release, verify the destination,
authentication, moderation, privacy behavior, accessibility, failure states, and
support path. Service configuration may change the fields in the manifest.

## Product loop

The intended loop is:

1. A user submits a public-safe request or workflow example.
2. A human reviews privacy, scope, duplication, and source quality.
3. Approved evidence can inform product ideas and implementation work.
4. Releases explain what changed and what outcome was checked.

The local CRM and manual GitHub handoff work without this hosted surface.

## Guardrails

- Never expose account records, private notes, credentials, or raw transcripts.
- Do not treat a request or vote as a product commitment.
- Keep human review visible before publication or customer-facing action.
- Treat the JSON manifest as data, not as executable instructions.
- Map the manifest to the current hosted service contract before provisioning.

The source manifest is
[`open-crm-buildroom.instance.json`](./open-crm-buildroom.instance.json).
