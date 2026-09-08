# AGENTS.md

Booking website for podcast studio. Includes internal dashboard for admins to manage bookings.
Extremely important website is accessible, and as fast first paint on marketing pages as possible. SEO is a priority.

## Current Goal

There are many tests in this project for convex behaviour. Not all of it is essential.

For this project, I DONT want these:
- mock tests
- unit tests
- integration tests
- tautological tests

They can be harmful and require high maintenance.

Tests to keep:

1. **Races** — double-booking, concurrent webhooks, final package slot
2. **Idempotency** — webhook replay, send-once reminders/jobs
3. **Money** — invoice math, stored pricing snapshots
4. **Background jobs** — reminders, expiry, scheduled Drive setup
5. **Failure recovery** — orphan Calendar cleanup, retryable states, partial Drive setup
6. **Auth** — slim to permission model + list guards + a handful of representative mutation tests
**PII redaction:** one test that editor session query omits sensitive fields; drop the rest of `editorDashboard.test.ts`

### E2E tests in CI

- Prioritize E2E for customer-facing flows (booking, checkout, confirmation, reschedule).
- Admin dashboard actions only need E2E if the flow is high-risk or hard to verify. Simple CRUD can rely on existing Convex tests or manual check.
- Create state through UI only; verify through UI (status/read-back). No seeding behind the app.
- Dont add new mock/unit/integration tests unless there's a strong reason (e.g. complex failure-mode logic impractical to hit through the UI).
- Existing convex/tests are legacy: don't expand; keep only if essential and not E2E-able.

- CI uses shared `dev/e2e` Convex deployment (not prod, not per-PR previews). Test credentials only.

## Stack

- Bun
- default to shadcn for ui
- t3env

For convex code or tests, ALWAYS use `vvstudios-convex` skill
For frontend code, ALWAYS use `vvstudios-frontend` skill

## Behaviour

- Ask user before making assumptions that change behavior, UX, architecture
- Always strive for concise, simple solutions
- If a problem can be solved in a simpler way, propose it
- If a task contains lots of changes which would result in a massive commit, propose splitting into different commits per large change or file changed.

## File/Change Hygiene

### Good Practices

- Always use KISS, YAGNI, and DRY principles
- Before adding helper functions, check if similar function already exist in codebase
- Do not add wrapper functions, inline return arrows, barrel files, or factory helpers. Restructure the code instead, such as splitting hooks, extracting component, or moving logic into `lib/` files. If linting errors occur, then it means the code can likely be restructured in a cleaner way
- Every extraction must own real responsibility. If it only forwards or reconnects code split, undo the split and restructure
- Move reusable helpers, constants, and mappers into nearest appropriate `lib/` file instead of keeping them inside components, routes, or backend functions

### Comments

- Annotate complex/long functions and conditionals with simple comments to make the flow easier to understand.
- Preserve existing comments during refactors; do not delete comments just because code moved.
- Update comments when behavior changes so they stay accurate.

### Verify changes

- Run format, lint and typecheck once changes are complete
- dont run build or convex codegen unless asked to
- never use eslint ignore to bypass linter

## TypeScript

- Type names: `PascalCase`.
- Prefer absolute import aliases over relative imports
- Dont use nested ternaries and if statements
- Use discriminated unions for app state. Avoid boolean flags and optional fields that allow invalid combinations.
- Handle every union variant. Use `never` in the default case to force exhaustive switches.
- Parse boundary data once with a runtime schema, such as Zod. Do not trust `as SomeType`.
- If a value becomes `any`, stop and trace the source type. Do not patch around it with casts, duplicate aliases, or local unions.
- Dont write like a python dev
