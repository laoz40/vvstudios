# AGENTS.md

Instructions for agents **implementing** work in this repository. Post-implementation standards for a review subagent live in [CODING_STANDARDS.md](./CODING_STANDARDS.md); do not load that file during normal feature work

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

After code changes run:

- `format`
- `lint`
- `test`
- `typecheck`
- `dead-code`
- `dupes`

Before opening PR:

- run the above commands
- run `test:e2e` (and related `test:e2e:*` scripts) when the change touches those flows.
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
