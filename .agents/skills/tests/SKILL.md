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

## When to mock

Mock at system boundaries only:

- External APIs (Stripe, email, Google)
- Time and randomness
- Database or file system when a real test instance is impractical

Dont mock internal collaborators or anything you control.

## Boundary design

- Pass external dependencies in (dependency injection), dont construct them inside the unit under test
- Prefer SDK-style interfaces (one function per external operation) over a generic fetcher with conditional mock logic

## Test file comments

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
