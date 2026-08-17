# ADR-005 — Use a Monorepo with pnpm + Turborepo

**Status:** Accepted  
**Date:** 2026-08-17  
**Deciders:** Architecture team

---

## Context

NEXUS consists of multiple related services: a Next.js frontend, a NestJS API, two worker services, a Python ML service, and shared TypeScript packages. These services need to:

- Share TypeScript types and validation schemas
- Share configuration utilities
- Be developed and tested together
- Have coordinated versioning
- Run CI efficiently (only rebuild what changed)

The question is: should these services be in one repository (monorepo) or separate repositories (polyrepo)?

---

## Decision

Use a **monorepo** managed by **pnpm workspaces** and **Turborepo**.

---

## Alternatives Considered

### Polyrepo (one repository per service)

- **Pro:** Independent versioning, deployments, and team ownership. No tooling overhead.
- **Con:** Shared type definitions must be published as npm packages and versioned separately, creating a painful "publish-wait-update-PR" cycle. Cross-service changes require coordinating multiple PRs across repos. Local development requires running multiple repos simultaneously. CI must be configured independently for each repo.
- **Decision:** Rejected. The overhead of coordinating type changes across repositories is unjustified for a platform developed by a single team.

### Nx Monorepo

- **Pro:** Powerful graph-based task orchestration, plugin ecosystem, code generators.
- **Con:** Steep learning curve. Heavy tooling with strong opinions. Overkill for this project's scale. Turborepo achieves the same caching and task graph with much less configuration.
- **Decision:** Rejected in favor of Turborepo's simpler model.

### Lerna + npm workspaces

- **Pro:** Mature, widely used for monorepos.
- **Con:** Lerna is less actively maintained since Nx acquisition. `pnpm workspaces` + Turborepo achieves the same without Lerna's complexity. pnpm's strict dependency isolation is superior to npm workspaces.
- **Decision:** Rejected.

### Bazel

- **Pro:** Hermetic builds, excellent for very large monorepos and multi-language support.
- **Con:** Extreme complexity. Requires significant infrastructure investment. Overkill unless the repository grows to hundreds of packages.
- **Decision:** Rejected.

---

## Consequences

**Positive:**

- Shared `packages/types` contains all TypeScript types used by both the API and frontend — single source of truth, no version drift.
- Shared `packages/config` contains environment variable schemas shared across Node.js services.
- Turborepo's task graph (`turbo.json`) enables: `turbo run build` builds all packages in the correct dependency order.
- Turborepo's remote caching means unchanged packages are never rebuilt in CI.
- A single `pnpm install` at the root installs all Node.js dependencies.
- Cross-service refactors happen in a single PR.
- Docker Compose at the root can reference all services.

**Negative:**

- Python (`apps/ml-service`) is not managed by pnpm — it has its own `requirements.txt` and `pyproject.toml`. This is expected for a polyglot monorepo.
- `pnpm-lock.yaml` can grow large with many dependencies.
- Developers unfamiliar with monorepos may have a learning curve.
- Turborepo's remote caching requires a Turborepo account or self-hosted cache server for full CI benefit.

---

## Notes

- `pnpm` is chosen over `npm` or `yarn` for its strict dependency isolation (no phantom dependencies), fast installs, and excellent workspace support.
- The `packages/` directory contains packages shared between Node.js apps only. The Python ML service is a separate runtime and cannot use TypeScript packages.
- A `turbo.json` at the root defines the task graph: `build` → `test` → `lint` with correct dependency ordering.
