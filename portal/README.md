# Open CRM Buildroom Portal Instance

This directory defines the public feedback portal that should serve Zentrik Open
CRM users.

The portal should be called **Open CRM Buildroom** and should use the alias
`open-crm`, giving it the expected production route:

```text
https://open-crm.ideas.zentrik.ai
```

The portal exists to make the product loop visible:

1. Users submit requests, complaints, workflow examples, and votes.
2. Zentrik processes the signal into product evidence.
3. Ideas are shaped, prioritized, and connected to agent work.
4. Releases are published with the evidence that caused them.
5. Users can see whether their engagement changed the product.

## Import Manifest

Use [`open-crm-buildroom.instance.json`](./open-crm-buildroom.instance.json) as
the source of truth for the first portal setup.

It is intentionally a manifest rather than a migration. The live portal schema
is owned by the Zentrik application and portal services; agents should translate
this manifest into the current API or database contract when creating the live
instance.

## Guardrails

- New public submissions should start as `hidden_until_review`.
- The portal should expose product feedback and release status, not private CRM
  records.
- The only product in the first portal should be `Zentrik Open CRM`.
- Public copy should focus on users shaping the CRM they use, not on autonomous
  AI replacing human product judgment.
