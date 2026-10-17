# AGENTS.md

These instructions apply during implementation. For user-requested code reviews, use the [code-review skill](./.agents/skills/code-review/SKILL.md) for the workflow and [CODING_STANDARDS.md](./docs/CODING_STANDARDS.md) for repository review rules. Load those review instructions and run review subagents only for requested reviews.

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
- If a task would produce a very large commit, split into smaller commits per major change or file group.
- Never use oxlint ignore comments to bypass the linter; fix or restructure instead.

- When adding a new feature, always avoid feature creep and over-engineering
    - Reach for the simplest thing that works
    - Suggest issues from edge cases before you implement fixes for them or build for hypothetical futures.
    - Do not assume backwards compatibility, migrations, or backfills are needed. Check if the feature is actually in the main branch already
    - Make sure not to write low value tests that don't relate to the core behaviour
    - Make sure not to add unecessary fields to the db schema
- Use YAGNI and DRY principles

Writing code is cheap for you, which makes over-engineering easy. Counter it by borrowing a human maintainer's fatigue. Aim for the most result with the least code and complexity. If a human developer would find the code exhausting to maintain, it is a bad solution. Be lazy. Stay simple.

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

Before implementing, debugging, or reviewing code under `convex/`, including schemas, handlers, services, and lib, read the [Convex guidelines](./convex/_generated/ai/guidelines.md), then the [project Convex guide](./docs/convex-three-layers.md). The project guide defines deployment workflow, layer boundaries, naming, and error handling.

## Tests

Before deciding whether to add tests, or writing, changing, or reviewing tests, read the [tests skill](./.agents/skills/tests/SKILL.md) for test admission, module interfaces, and mocking conventions.
