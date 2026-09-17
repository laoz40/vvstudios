# AGENTS.md

Booking website for podcast studio. Includes internal dashboard for admins to manage bookings.
Extremely important website is accessible, and as fast first paint on marketing pages as possible. SEO is a priority.

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

### Verify changes

- Run format, lint, test, typecheck, dead-code, dupes (bun scripts) once changes are complete and before creating any PRs. (e2e only if relevant)
- dont run build or convex codegen unless asked to
- never use eslint ignore to bypass linter

## TypeScript

- Type names: `PascalCase`.
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

- Services whose handlers are exported in the same API module may need an explicit `ResultAsync<..., { reason: string }>` return type to break circular inference.

### Neverthrow

- Keep Convex handlers as boundary adapters: each handler should call one service function and use `.match(tupleOk, tupleErr)` to convert service `Result` into tuple returned to client.
- `convex/services` should only contain service chain functions, a readable neverthrow `andThen` chain of domain operations. Chain errors propagate to the handler automatically.
- Put domain operations used by service chains in nearest appropriate file under `convex/lib`. Do not define helper operations in service files
- Result helpers in `convex/lib/result.ts`. Don't call `fromSafePromise`/`fromPromise` directly.
  - `okOrThrow` — `ctx.db`, `runQuery`/`runMutation` returning raw values. Infra failure throws; domain errors (`NOT_FOUND`, etc.) you return in `.andThen`.
  - `fromConvexTuple` — `runQuery`/`runMutation` whose handler uses `.match(tupleOk, tupleErr)`.
  - `tryPromise` — external APIs (Stripe, Resend, Google, render). Failure becomes domain `err` in `catch`.

## Tests

Tests verify behavior through public interfaces, not implementation details. A good test reads like a specification: "user can checkout with valid cart" tells you what capability exists and survives refactors.

```typescript
// GOOD: tests observable behavior
test("user can checkout with valid cart", async () => {
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});

// BAD: mocks internal collaborator
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

### Good tests

- Integration-style: test through real interfaces, not mocks of internal parts
- Public API only; describe WHAT, not HOW
- One logical assertion per test
- Expected values are independent literals, not recomputed the same way the implementation computes them

### Bad tests

Red flags:

- Mocking internal collaborators or your own modules
- Testing private methods
- Asserting call counts or order
- Bypassing the public API to verify (e.g. raw DB read when a retrieval query exists)
- Test name describes HOW not WHAT
- Tautological: expected value restates the implementation

### When to mock

Mock at system boundaries only:

- External APIs (Stripe, email, Google)
- Time and randomness
- Database or file system when a real test instance is impractical

Dont mock internal collaborators or anything you control.

### Boundary design

- Pass external dependencies in (dependency injection), dont construct them inside the unit under test
- Prefer SDK-style interfaces (one function per external operation) over a generic fetcher with conditional mock logic

### Test file comments

- At top of every test file, maintain one file-level comment that describes each test
- Format each test with short subheading, description on next line
- Dont place comments immediately above individual tests

## E2E

- Prioritise E2E for customer-facing flows
- Create state through UI only; verify through UI (status/read-back). No seeding behind the app.
- CI E2E test stops before checkout due to Stripe hCaptcha; local specs cover payment and reschedule happy paths.

## Convex tests

- Only to test important flows and failures:
    - Races
    - Idempotency — webhook replay, send-once reminders/jobs
    - Money calculations
    - Background jobs — reminders, expiry, scheduled Drive setup
    - Failure recovery — orphan Calendar cleanup, retryable states, partial Drive setup
- Don't add unless you can explain with a strong reason.
- Use `createConvexTest`; call public queries/mutations when they exist.
- `ctx.db.get` in test helpers is fine when no caller-facing query exposes the state you assert on.
