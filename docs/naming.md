# Naming

## Decision

The product ships as **Open CRM** (full name **Zentrik Open CRM**) with the
descriptor *relationship management for people and their agents*. The name
lives in one place, [`src/lib/brand.ts`](../src/lib/brand.ts), and every
user-facing surface, command, and generated file reads it from there.

## The alternative under consideration

*Open Agent Relationship Management* ("Open ARM") names the product's actual
difference: relationships kept by people and their agents together. It is
memorable and the acronym is short.

Two things weigh against it as the product name:

- Read cold, "agent relationship management" describes managing relationships
  *with* agents, the way "vendor relationship management" does. Every first
  explanation would start by correcting that.
- "CRM" is the category people search for and recognize. A local-first,
  open-source CRM that agents can work is a clear claim; a new category name
  asks people to learn a term before they learn the product.

The recommendation is to keep **Open CRM** as the name and use the agent
framing as the descriptor and the story, where it can be as explicit as we
like. If the decision goes the other way, the rename is:

1. `src/lib/brand.ts` (name, full name, descriptor).
2. The npm package name and `bin` in `package.json`; the `open-crm` command
   name and the `./crm` wrapper written by `init` (`cli/templates.ts`).
3. The repository name and its GitHub redirect; `repoUrl` in `brand.ts` and
   the links in `src/lib/feedback.ts` and the docs.
4. Bundle schema identifiers `open-crm-feedback.v1` and
   `open-crm-signals.v1` stay as they are; they are formats, not the brand.
5. The brand assets under `assets/brand/`.

## What stays true under either name

- Agents work the same records as people, through checked operations.
- Nothing an agent proposes lands until a person approves it.
- Every fact shows its source, or shows as a hunch.
- Account work stays here; product decisions go to Zentrik.
