# AGENTS.md

Instructions for agents **implementing** work in this repository. Post-implementation standards for a review subagent live in [docs/CODING_STANDARDS.md](./docs/CODING_STANDARDS.md); do not load that file during normal feature work.

## Project

Booking website for a podcast studio, plus an internal dashboard for admins to manage bookings.
Operational priorities: accessibility, fast first paint on marketing pages, and SEO.

## Stack

- Bun
- Convex backend
- Default to shadcn for UI
- t3env for env variables

## Behaviour

- Ask before making assumptions that change behavior, UX, or architecture.
- If a problem can be solved in a simpler way, propose it.
- If a task would produce a very large commit, propose splitting into smaller commits per major change or file group.
- Do not blindly assume a schema migration or backwards compatibility is required. Features may not be live yet; ask to clarify when unsure.
- Prefer **KISS**, **YAGNI**, and **DRY** in this codebase. Reach for the simplest thing that works; do not build for hypothetical futures; do not copy-paste when one shared place is enough.
- Never use oxlint ignore comments to bypass the linter; fix or restructure instead.

## Plans

Large features and PR stacks are documented under `plans/`. Start at [plans/INDEX.md](./plans/INDEX.md) for active epics, merged stacks, and key file entry points.

## Rule enforcement

Each major instruction below maps to how it is enforced in this repo (scripts, oxlint plugins, skills, or review). Convex-specific rules from `@convex-dev/eslint-plugin` were added in `.oxlintrc.json` (`explicit-table-ids`, `no-filter-in-query`, `import-wrong-runtime`, and related `@convex-dev/*` rules on `convex/**`).

| AGENTS rule | Enforcement |
| --- | --- |
| Implementation vs review split | [AGENTS.md](./AGENTS.md) (this file) vs [docs/CODING_STANDARDS.md](./docs/CODING_STANDARDS.md); `code-review` skill loads standards for review subagents only |
| Ask before behavior / UX / architecture assumptions | Review (`code-review` skill, spec axis) |
| Prefer simpler solutions; KISS / YAGNI / DRY | Review (`docs/CODING_STANDARDS.md` simplicity section) |
| Split large commits | Review |
| Clarify migrations / backwards compatibility | Review + relevant `plans/*` epic |
| No oxlint ignore bypasses | `bun run lint` (oxlint); `reportUnusedDisableDirectives: error` in `.oxlintrc.json` |
| After changes: `format`, `lint`, `test`, `typecheck` | `package.json` scripts; CI job `lint-and-test` (`.github/workflows/ci.yml`) |
| Before PR: `dead-code`, `dupes` | `bun run dead-code` / `bun run dupes` (fallow); same CI job |
| Before PR: `test:e2e` when flows touched | `package.json` `test:e2e*` scripts; CI `e2e` job on pull requests |
| Before PR: `code-review` skill in a subagent | Skill only (not CI) |
| Do not run `build` unless asked | Convention |
| Do not start dev server if one is running | Convention |
| Convex: read `convex/_generated/ai/guidelines.md` | Skill checklist (`.agents/skills/convex/SKILL.md` routes here); review when `convex/` changes |
| Convex cloud VM work | `.agents/skills/convex-cloud-agents/SKILL.md` |
| Prefer `npx convex dev --once` (no long-running `convex dev`) | Convention |
| No duplicate constants across frontend and Convex | `bun run dupes` (fallow); extract shared source (future `shared/` package per architecture plan) |
| No `Internal` suffix on Convex function names | Review |
| Service `ResultAsync` explicit return when needed for inference | `bun run typecheck` |
| Handler → one service → `.match(tupleOk, tupleErr)` | Review + `docs/CODING_STANDARDS.md`; archetype doc planned (phase 0+) |
| `convex/services/**` = neverthrow chains only | Review; `neverthrow/no-service-error-remap-switch` on `convex/lib/**` and `convex/services/**` |
| Domain ops in `convex/lib/**`, not in service files | Review |
| `fromSafePromise` / `fromPromise` only via `convex/lib/result.ts` | Review; grep / future oxlint (not automated in CI yet) |
| `okOrThrow`, `fromConvexTuple`, `tryPromise` usage | Review + `convex/lib/result.ts` |
| Convex import style and query patterns | `@convex-dev/eslint-plugin` on `convex/**` (see `.oxlintrc.json` overrides) |
| Type safety, complexity, file size | oxlint `typescript/*`, `max-lines` (600), `complexity`, `max-depth`, `import/no-cycle` |
| React / a11y / import aliases in `src/**` | oxlint `react/*`, `jsx-a11y/*`, `no-restricted-imports` (`#/` alias) |
| Tests follow repo conventions | `.agents/skills/tests/SKILL.md` |
| Anti-slop patterns (assertions, parameters, spacing, etc.) | Custom plugin `tools/oxlint/anti-slop` via `bun run lint` |

## Verify changes

After code changes run:

- `format`
- `lint`
- `test`
- `typecheck`

Before opening PR:

- run the above commands, plus:
  - `dead-code`
  - `dupes`
  - `test:e2e` and related `test:e2e:*` scripts when the change touches those flows.
- Use `code-review` skill within a subagent.

- Do not run `build` unless asked.
- Do not start the dev server if one is already running.

## Convex

### Workflow

- For Convex code, read `convex/_generated/ai/guidelines.md` first.
- Prefer `npx convex dev --once` to verify changes when no long-running `convex dev` is already up and no deploy key is set (local backend).
- Do not start a long-running `convex dev`.
- Cloud agents doing Convex work: use the `convex-cloud-agents` skill under `.agents/skills/`.

### Conventions (while implementing)

- Do not duplicate constants or defaults between the frontend and Convex; extract shared values to one importable source when possible.
- Do not suffix internal Convex function names with `Internal` or similar; that is obvious from context.
- Services whose handlers are exported in the same API module may need an explicit `ResultAsync<..., { reason: string }>` return type to break circular inference.

#### Neverthrow

- Keep Convex handlers as boundary adapters: each handler should call one service function and use `.match(tupleOk, tupleErr)` to convert the service `Result` into the tuple returned to the client.
- `convex/services` should only contain service chain functions: a readable neverthrow `andThen` chain of domain operations. Chain errors propagate to the handler automatically.
- Put domain operations used by service chains in the nearest appropriate file under `convex/lib`. Do not define helper operations in service files.
- Result helpers live in `convex/lib/result.ts`. Do not call `fromSafePromise` / `fromPromise` directly.
  - `okOrThrow` — `ctx.db`, `runQuery` / `runMutation` returning raw values. Infra failure throws; domain errors (`NOT_FOUND`, etc.) you return in `.andThen`.
  - `fromConvexTuple` — `runQuery` / `runMutation` whose handler uses `.match(tupleOk, tupleErr)`.
  - `tryPromise` — external APIs (Stripe, Resend, Google, render). Failure becomes domain `err` in `catch`.

## Tests

When writing tests, use the `tests` skill in `.agents/skills/tests/`.
