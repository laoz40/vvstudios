---
name: tests
description: Test conventions for this repo. Use when writing, adding, reviewing, or refactoring unit, integration, E2E, or Convex tests.
---

# Tests

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

## Good tests

- Integration-style: test through real interfaces, not mocks of internal parts
- Public API only; describe WHAT, not HOW
- One logical assertion per test
- Expected values are independent literals, not recomputed the same way the implementation computes them

## Bad tests

Red flags:

- Mocking internal collaborators or your own modules
- Testing private methods
- Asserting call counts or order
- Bypassing the public API to verify (e.g. raw DB read when a retrieval query exists)
- Test name describes HOW not WHAT
- Tautological: expected value restates the implementation

## Test behavior, not implementation

Apply these checks whenever you write, change, or keep a test. Call the code the way its users do, with one concrete input, inside the test body. Assert the result they observe against an independent literal expected value.

Before keeping a test, ask whether it would still pass if every function it imports returned `undefined`. If yes, rewrite the assertion or delete the test. Passing this check is necessary, not sufficient: `toBeDefined`, `toBeTruthy`, `toBeInstanceOf`, and `toBeGreaterThan(0)` can reject `undefined` while still failing to specify the expected behavior.

Look for these low-value shapes:

- Weak or no assertion: no `expect`, or only existence, truthiness, type, non-throwing, or broad numeric checks.
- Mock or absence only: only checking calls, no calls, `undefined`, an empty collection, or inequality with a wrong value.
- Self-referential expectations: `expect(f(a)).toBe(f(a))`, or deriving an expected URL using the same builder the subject uses.
- Constant pins: restating a hand-maintained constant, config default, table row, or prompt string. Test the mechanism that reads the value instead. A constant pin blocks edits without proving behavior.
- Fixture asserts fixture: asserting data the test constructed or computed in `beforeEach`, without exercising the subject inside the test body.

Rewrite with concrete behavior, for example `expect(slugify("Hello, World!")).toBe("hello-world")`. For an absence, assert the presence on another input in the same test. For a boundary mock, assert the concrete payload it received or the observable state after the call, rather than merely checking that it was called. This does not permit mocking internal collaborators.

When no behavioral assertion exists, delete the test. Such tests consume CI time and review attention without detecting the intended defects.

Keep tests of relationships across table rows, such as shared keys or existing parents, and compile-time checks in `*.test-d.ts` files.

## When to mock

Mock at system boundaries only:

- External APIs (Stripe, email, Google)
- Time and randomness
- Database or file system when a real test instance is impractical

Dont mock internal collaborators or anything you control.

## Boundary design

- Pass external dependencies in (dependency injection), dont construct them inside the unit under test
- Prefer SDK-style interfaces (one function per external operation) over a generic fetcher with conditional mock logic

## Frontend unit tests

- Put Vitest files under `src/sites/studio/features/<feature>/tests/`, not beside implementation files in `lib/`.

## Test file comments

- At top of every test file, maintain one file-level comment that describes each test
- Format each test with short subheading, description on next line
- Dont place comments immediately above individual tests

## E2E

- Prioritise E2E for customer-facing flows
- Create state through UI only; verify through UI (status/read-back). No seeding behind the app.
- CI E2E test stops before checkout due to Stripe hCaptcha; local specs cover payment and reschedule happy paths.

## Convex tests

For Convex test placement or Stripe, Google SDK, PDF, and email boundary stubs, read [boundary-testing.md](references/boundary-testing.md) before choosing fixtures.

- Only to test important flows and failures:
    - Races
    - Idempotency — webhook replay, send-once reminders/jobs
    - Money calculations
    - Background jobs — reminders, expiry, scheduled Drive setup
    - Failure recovery — orphan Calendar cleanup, retryable states, partial Drive setup
- Don't add unless you can explain with a strong reason.
- Use `createConvexTest`; call public queries/mutations when they exist.
- `ctx.db.get` in test helpers is fine when no caller-facing query exposes the state you assert on.
