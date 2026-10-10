# AGENTS.md

Instructions for agents **implementing** work in this repository. Post-implementation standards for a review subagent live in [CODING_STANDARDS.md](./docs/CODING_STANDARDS.md); do not load that file during normal feature work. Only load and use review subagent when user asks for code review.

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

## Verify changes

- After code changes and before opening a PR, run `bun run verify`. [scripts/verify.sh](./scripts/verify.sh) installs dependencies and runs the local checks in order, stopping on failure.
- Add `--convex` when Convex functions changed. Deployment finishes before any requested E2E tests start.
- Run E2E only immediately before creating a PR, not during routine development verification. Run the relevant flows once against the final changes.
- For pre-PR booking E2E coverage, run `bun run verify --e2e all`. It runs session reschedule (including payment) and package scheduling (including payment) sequentially, without smoke or duplicate payment-only runs.
- Payment E2E runs headed. The runner checks display/browser availability before local checks and exits immediately if unavailable; complete pre-PR E2E on a machine with a usable display.
- For changes limited to one flow, select `--e2e smoke`, `--e2e session-reschedule`, or `--e2e package-schedule`. For dashboard changes, use the related flow commands in [.agents/skills/verify-vvstudios/SKILL.md](./.agents/skills/verify-vvstudios/SKILL.md).
- Do not run `build` unless asked.
- Do not start the dev server if one is already running.

## Convex

### Workflow

- For Convex code, read `convex/_generated/ai/guidelines.md` first.
- Use `bun run verify --convex` to verify and sync changed functions to the configured dev deployment when no long-running `convex dev` is already up and no deploy key is set. If one is already running, omit `--convex` and wait for it to finish syncing before E2E.
- Do not start a long-running `convex dev`.
- Cloud agents doing Convex work: use the `convex-cloud-agents` skill under `.agents/skills/`.

### Three-layer architecture

Read **[docs/convex-three-layers.md](./docs/convex-three-layers.md)** first for handlers → services → lib (the project goal for every endpoint).

Quick map:

| Layer | Where | Calls | You should see |
| --- | --- | --- | --- |
| Handler | `convex/<feature>/*.ts` (plus root globals like `schema.ts`, `http.ts`, `crons.ts`) | services only | A short, flat list of steps (*what* happens) |
| Service | `convex/<feature>/services/**`, `convex/shared/services/**` | lib (+ other services) | One abstraction per function; policy here |
| Lib | `convex/<feature>/lib/**`, `convex/shared/lib/**` | — | Small DB/logic primitives; no policy |

Feature folders (`booking`, `packages`, `sessions`, `stripe`, `drive`, …) hold handlers, services, and lib for that area. Cross-cutting code (auth, `result`, email send, admin search validators) lives under `convex/shared/`. Convex API paths follow folders: e.g. `convex/packages/packageScheduling.ts` → `api.packages.packageScheduling.*`.

Handlers: neverthrow chain of service steps, no domain `if`s, `.match(tupleOk, tupleErr)` on tuple endpoints. Crons and internal mutations reuse the same service steps.

When you touch code that breaks the guide, fix it only if in scope; do not repo-wide sweep.

### Conventions (while implementing)

- Do not duplicate constants or defaults between the frontend and Convex; extract shared values to one importable source when possible.
- Do not suffix internal Convex function names with `Internal` or similar; that is obvious from context.
- Services whose handlers are exported in the same API module may need an explicit `ResultAsync<..., { reason: string }>` return type to break circular inference.
- New service **functions** are verb-first; do not bulk-rename existing symbols. Split a service that branches on which endpoint called it (mode flags, endpoint-only optional args).

### Neverthrow

- Return real domain `reason` codes from lib, email senders, and rate limiters. Do not `mapErr` into synthetic codes. Fire-and-forget success returns `null`.
- Service and lib steps return `Result` / `ResultAsync`; chain with `.andThen` / `.map`. Do not wrap a whole function in `okOrThrow`.
- Helpers in `convex/shared/lib/result.ts` only — do not call `fromSafePromise` / `fromPromise` directly.
  - `okOrThrow` — single Convex I/O at that step: `ctx.db.*`, `ctx.scheduler.*`, `ctx.auth.getUserIdentity()`, or raw `runQuery` / `runMutation`. Infra throws; domain outcomes use `err(...)` in `.andThen`.
  - `fromConvexTuple` — `runQuery` / `runMutation` whose handler uses `.match(tupleOk, tupleErr)`.
  - `tryPromise` — external APIs (Stripe, Resend, Google, render); `catch` maps to domain `err`, never rethrows.
- Lib exports returning `ResultAsync` build it from steps; no export-level `tryPromise` / `okOrThrow` around internal async helpers.
- Paginated query handlers may return plain pagination at the boundary when tuples break Convex pagination; use `okOrThrow` on individual reads inside service/lib row-load steps.

## Tests

When writing tests, use the `tests` skill in `.agents/skills/tests/`.
