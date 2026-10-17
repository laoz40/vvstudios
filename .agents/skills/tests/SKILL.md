---
name: tests
description: Test conventions for this repo. Use when writing, adding, reviewing, or refactoring unit, integration, E2E, or Convex tests.
---

# Tests

## When to add tests

This rule applies to unit, integration, E2E, and Convex tests. Add tests selectively for critical application behavior. A new feature, changed function, refactor, or bug fix does not automatically require a new test. Adding no tests is a valid outcome.

Before adding a test, identify:

- The specific plausible failure it catches.
- The consequence for customers or studio operations.
- Why existing tests or static checks do not already protect against it.

"This feature needs coverage" is not a sufficient reason. A precise behavioral assertion is necessary, but does not by itself justify a test.

Prioritize payment correctness, booking and scheduling integrity, authorization, duplicate processing, and recovery from partial failures. These are examples of consequential risks, not a coverage checklist.

Routine rendering, copy, styling, simple CRUD, trivial helpers, and implementation refactors normally need no new tests. Add one only when it protects a consequential invariant.

Check existing coverage first and prefer extending an existing test that protects the same behavior. Do not duplicate coverage at multiple layers unless each test catches a distinct consequential failure.

## How to write tests

Tests verify behavior through public interfaces, not implementation details. A good test reads like a specification: "user can checkout with valid cart" tells you what capability exists and survives refactors.

A public interface means a useful capability for the module's callers, not every exported function or only browser-facing endpoints.

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

## Module interfaces

- For each added or changed behavioral test, identify the module's meaningful public interface and the consequential failure the test protects against. An exported helper is not automatically a public interface. Callers should use that interface for a useful capability without knowing its internal steps, flags, or database patches.
- Push tests of workflow helpers, guards, and patch builders up to the existing module interface when that interface can exercise the same failure. Extend an existing behavioral test and remove equivalent lower-level coverage. Preserve distinct failure cases before deleting tests; moving a file or renaming a helper does not improve the test.
- For Convex workflows, prefer registered queries, mutations, and actions through generated `api` or `internal` references. Internal entrypoints used by jobs, webhooks, or other Convex functions can be meaningful interfaces. Keep handlers → services → lib; a test can exercise the whole module through a handler without collapsing those layers.
- Direct tests of meaningful pure modules, such as shared pricing calculations, remain valid when they protect a distinct consequential invariant. Module-interface tests do not require browser E2E. Stub external transport, time, or randomness rather than internal collaborators; use existing retrieval queries for read-back when they expose the state being checked.
- Reject pass-through wrappers, barrel exports, and test-only production entrypoints introduced merely to make an implementation import look public. A deep module hides substantial behavior behind a small useful interface. If no useful interface exists, report the design problem rather than silently prescribing an architecture migration.

## Good tests

- Integration-style: test through real interfaces, not mocks of internal parts
- Public API only; describe WHAT, not HOW
- One behavior per test; use the assertions needed to prove it
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
- Constant pins: restating a hand-maintained constant, config default, table row, or prompt string. A constant pin blocks edits without proving behavior. Only test the mechanism that reads the value when it meets the criteria in "When to add tests".
- Fixture asserts fixture: asserting data the test constructed or computed in `beforeEach`, without exercising the subject inside the test body.

For tests that meet the criteria in "When to add tests", assert concrete behavior, such as replaying a payment webhook and observing that the booking remains confirmed with one payment recorded. For an absence, assert the presence on another input in the same test. For a boundary mock, assert the concrete payload it received or the observable state after the call, rather than merely checking that it was called. This does not permit mocking internal collaborators.

When no behavioral assertion exists, delete the test. Such tests consume CI time and review attention without detecting the intended defects.

Tests of relationships across table rows, such as shared keys or existing parents, and compile-time checks in `*.test-d.ts` files must also meet the criteria in "When to add tests". Their test shape alone does not justify keeping them.

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

- Prioritize E2E for critical customer-facing flows that meet the criteria in "When to add tests"; do not add one for every feature
- Create state through UI only; verify through UI (status/read-back). No seeding behind the app.
- CI session and package E2E tests open Stripe checkout and close it without completing payment because of Stripe hCaptcha. Preserve both tests; local payment, reschedule, and package-scheduling specs protect distinct behavior.

## Convex tests

For Convex test placement or Stripe, Google SDK, PDF, and email boundary stubs, read [boundary-testing.md](references/boundary-testing.md) before choosing fixtures.

- Apply the global criteria in "When to add tests". Candidate risks include races, webhook replay, duplicate reminders or jobs, money calculations, expiry, scheduled Drive setup, orphan Calendar cleanup, retryable states, and partial Drive setup. These examples are not a requirement to cover every job or failure path.
- Use `createConvexTest`; call registered queries, mutations, or actions through generated `api` or `internal` references as described in [Module interfaces](#module-interfaces).
- `ctx.db.get` in test helpers is fine when no caller-facing query exposes the state you assert on.
