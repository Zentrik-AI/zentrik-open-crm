# Licensing And IP

This project is intended to become a real open-source CRM while preserving
Zentrik AI's company, product, and platform advantages.

This document is an operating decision, not legal advice. Before the repository
is made public, Zentrik AI should still do a final legal review.

## Final Approach

Use **Apache License 2.0** for the public Zentrik Open CRM repository.

Apache 2.0 gives users and contributors broad rights to use, modify, distribute,
and commercialize the CRM. It also includes an explicit patent grant and a
patent termination clause, which is a better fit for a company-led project than
a minimal permissive license.

The license applies to repository contents unless a file says otherwise. It does
not grant trademark rights, hosted-service rights, private API access, private
workspace access, or rights to proprietary Zentrik platform code.

## Why This Is The Right Default

The goal is adoption and trust. The CRM should be easy for builders,
consultants, agencies, and small B2B teams to run, fork, inspect, and extend.

Apache 2.0 supports that goal while keeping the defensible parts of Zentrik
outside the open-source boundary:

- Zentrik's hosted product intelligence platform
- Zentrik workspace APIs and internal services
- private signal ingestion, insight generation, and orchestration systems
- hosted Open CRM Cloud operations
- real user data, customer workspaces, and runtime credentials
- Zentrik trademarks, names, and brand identity

## Alternatives Considered

### MIT

MIT would maximize simplicity, but it does not include the same explicit patent
grant. For a company-led product that may grow agentic workflows, connectors,
and hosted deployments, Apache 2.0 is the safer permissive baseline.

### GPL Or AGPL

GPL and AGPL would provide stronger copyleft protection. AGPL is particularly
designed to require source availability for modified network services.

That protection comes with adoption cost. It can make commercial usage,
embedding, internal deployments, and hosted experiments harder for the exact
audience we want to reach. If Zentrik wants the CRM to spread as a credible
builder tool, permissive licensing is the better default.

### Business Source, Functional Source, SSPL, Or Custom Source-Available Terms

These can protect commercial value, but they are not the right fit for a product
we intend to call open source. The public positioning depends on users trusting
that the CRM is genuinely open-source software, not merely source-available.

## Public Repository Boundary

Allowed in this repository:

- CRM application code
- local-first data model
- synthetic fixtures and demo records
- public documentation
- public-safe Buildroom manifests
- issue templates, contribution workflows, and public release assets

Not allowed in this repository:

- private Zentrik app code
- private workspace exports
- production API keys or workspace IDs
- private customer data, transcripts, emails, or support records
- proprietary Zentrik insight generation, ranking, or orchestration internals
- hosted cloud operations, billing, support, and compliance systems unless
  explicitly released

## Contribution Terms

Contributions intentionally submitted to this repository are accepted under
Apache 2.0 unless the contributor clearly states otherwise before inclusion.

Contributors must only submit work they have the right to contribute. Public
issues, pull requests, screenshots, logs, and fixtures must not contain private
customer data, credentials, confidential employer material, or private Zentrik
data.

For larger corporate contributions, Zentrik AI may require an additional
contributor agreement before merging.

## Dependency Posture

Current direct dependencies use permissive licenses:

- Apache 2.0: `@playwright/test`, `typescript`
- MIT: React, Vite, Tailwind, PostCSS, Autoprefixer, type packages,
  `tailwind-merge`, `clsx`
- ISC: `lucide-react`

Before public release, rerun dependency license review from a clean install and
resolve any incompatible new dependency.

## Release Rule

Keep the GitHub repository private until every public-release gate is complete.
Changing visibility should be the last step, after license review, secret
scanning, history review, branch protection, vulnerability reporting, and
trademark review.

If private material ever appears in history before public launch, do not publish
that history. Create a sanitized public repository from a clean export instead.

## References

- [Open Source Definition](https://opensource.org/definition-annotated)
- [OSI approved licenses](https://opensource.org/licenses)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [Apache guidance for applying Apache 2.0](https://www.apache.org/legal/apply-license)
- [GNU AGPLv3](https://www.gnu.org/licenses/agpl-3.0)
- [Developer Certificate of Origin](https://developercertificate.org/)
