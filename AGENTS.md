# AGENTS.md

Booking website for podcast studio. Includes internal dashboard for admins to manage bookings.
Extremely important website is accessible, and as fast first paint on marketing pages as possible. SEO is a priority.

## Current Goals

### Convex Tests

- Keep tests for races, idempotency, money, background jobs, failure recovery, and auth.
- Auth: keep the permission model, list-query guards, and a few representative mutation deny tests. Trim per-endpoint matrix in `authorization.test.ts` — every admin mutation uses the same `requirePermission` guard
- One PII redaction test in `editorDashboard.test.ts`;
- Drop the rest. No mock, unit, integration, or tautological tests. Don't expand `convex/tests` unless E2E can't cover it.

### E2E

- Customer success paths only. Failures belong in Convex.
- Create state through UI only; verify through UI (status/read-back). No seeding behind the app.
- CI stops before checkout; local specs cover payment and reschedule happy paths.
- Admin: E2E only for high-risk flows.

## Stack

- Bun
- default to shadcn for ui
- t3env

## Behaviour

- Ask user before making assumptions that change behavior, UX, architecture
- Always strive for concise, simple solutions
- If a problem can be solved in a simpler way, propose it
- If a task contains lots of changes which would result in a massive commit, propose splitting into different commits per large change or file changed.

## Code Style Guidelines

### Naming Conventions

- component files: `PascalCase.tsx`.

### Components and pages

- Extract major or self-contained UI sections into separate component files instead of growing a single large component file
- Group related React setup/state in clear sections, use short section comments for group
- Add short comments before `useEffect` blocks that explain what effect does

### Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).
- Do not add classes that already exist in the parent component
- For loading, show animated Lucide spinner alongside concise state label (eg. `Saving`), not just trailing-ellipsis label eg. `Saving...`.

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

- At top of every test file, maintain one file-level comment that describes each test.
    - Format each test with short subheading, description on next line.
    - Dont place comments immediately above individual tests.

### Verify changes

- Run format, lint, test and typecheck once changes are complete. (e2e only if relevant)
- dont run build or convex codegen unless asked to
- never use eslint ignore to bypass linter

## TypeScript

- Type names: `PascalCase`.
- Prefer absolute import aliases over relative imports
- Dont use nested ternaries and if statements
- Use discriminated unions for app state. Avoid boolean flags and optional fields that allow invalid combinations.
- Handle every union variant with `exhaustiveCheck` default
- Parse boundary data once with Zod.
- Dont write like a python dev

## Convex

- For Convex code, always read `convex/_generated/ai/guidelines.md` first.

- Dont duplicate constants/defaults between frontend and Convex; extract shared values to one importable source when possible.
- Dont suffix internal Convex function names with `Internal` or similar; these things are obvious from looking at the code already

- Dont blindly assume a migration needs to occur or backwards compatibility is necessary. Usually, feature being worked on isnt implemented so no live data. Always ask user to clarify.

### Neverthrow

- Keep Convex handlers as boundary adapters: each handler should call one service function and use `.match(tupleOk, tupleErr)` to convert service `Result` into tuple returned to client.
- `convex/services` should only contain service chain functions, a readable neverthrow `andThen` chain of domain operations.
- Put domain operations used by service chains in nearest appropriate file under `convex/lib`. Do not define helper operations in service files

