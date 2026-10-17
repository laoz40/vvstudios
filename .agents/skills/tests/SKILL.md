---
name: tests
description: Propose high-value tests for user approval; implement only approved tests through meaningful module interfaces. Use before proposing, adding, changing, reviewing, or refactoring unit, integration, E2E, or Convex tests.
---

# Tests

## Approval and proposals

Add, modify, or delete test code only with explicit user approval for those changes. This includes cases, assertions, and test-only helpers in existing files. A feature request, bug fix, refactor, or instruction to verify is not approval to write tests.

Without approval, append qualifying candidates to [test proposals](../../../docs/test-proposals.md) using that file's format. Extend an existing candidate when it covers the same failure. Continue the authorized implementation and mention the updated list in the handoff; leave approval to the user's periodic review rather than asking for each candidate. Running existing tests is allowed.

The implementation rules below apply only to approved test work. Review findings can propose changes, but do not authorize them.

## When to add tests

Default to no new tests. A feature, bug fix, refactor, new export, branch, or coverage gap does not by itself justify one. Routine rendering, copy, styling, simple CRUD, and trivial helpers normally need none.

Before proposing a test, identify all four:

1. A specific plausible failure in the current behavior or requested change.
2. Its consequence for customers or studio operations.
3. Why existing tests and static checks do not already catch it.
4. The existing module interface and concrete observable result that would detect it.

If any answer is missing, do not propose the test. Precise assertions alone do not establish value; "added coverage" is insufficient.

Prioritize risks such as incorrect payments, scheduling conflicts, unauthorized access, duplicate processing, and partial-failure recovery. These are examples, not a coverage checklist. Table relationships and compile-time tests must pass the same admission rule.

Check existing coverage first. Prefer extending a behavioral test over creating a new file or testing the same failure at multiple layers. Preserve distinct failure cases when consolidating tests.

## Module interfaces

Test a useful capability that callers use without knowing its internal steps. Being exported, pure, small, or branch-heavy does not make a helper a meaningful public interface. Module-interface tests can be unit or integration tests; they do not require browser E2E.

For workflow helpers, guards, patch builders, and mappers, exercise the consequential failure through the existing workflow interface. Keep direct tests of meaningful pure modules, such as shared pricing calculations, only for distinct consequential invariants.

Ask: would renaming, splitting, or replacing internal helpers break this test while preserving the module's behavior? If yes, rewrite the test through the module interface. Renaming a helper or moving its test file does not fix the problem.

For example:

- Reject a booking test that only asserts `buildConfirmationPatch` returns `{ status: "confirmed" }` or that an internal save helper was called.
- Exercise booking confirmation through its registered mutation, then read the booking through an existing retrieval query and assert its expected state. A payment-replay test should prove the booking remains confirmed with one payment recorded after replay.

Reject barrel exports, forwarding wrappers, and test-only production entrypoints introduced to make an implementation import look public. If no useful interface exists, report the design problem rather than inventing one or silently migrating the architecture.

## Assertions

Call the subject inside the test body with concrete input. Test one behavior and assert caller-visible results, persisted state, or external-boundary payloads against independent literal expectations.

Reject tests that only:

- Check existence, truthiness, type, non-throwing, or broad numeric bounds such as `toBeGreaterThan(0)`.
- Assert internal collaborator calls, call counts, call order, or private methods.
- Compare a function with itself, derive expectations with the same implementation helper, or pin a hand-maintained constant, config default, table row, or prompt string.
- Assert fixture data without exercising the subject inside the test body.
- Assert only `undefined`, an empty collection, or inequality with a wrong value. For absence behavior, also assert presence for another input in the same test.

If every imported function returned `undefined`, the test must fail. This is necessary but insufficient; existence assertions still do not specify behavior. For boundary mocks, assert the concrete payload or resulting observable state rather than merely that a call occurred. Test a mechanism reading a constant only when it passes the admission rule.

Rewrite or remove a test with no behavioral assertion. Preserve distinct consequential cases before removing equivalent lower-level coverage.

## Mocks and boundaries

Keep internal collaborators real. Stub only external APIs, time, randomness, or database/filesystem access when a real test instance is impractical. Inject external dependencies at the system boundary and prefer one SDK-style operation per method over a generic fetcher with conditional mock logic.

Use an existing retrieval query for read-back when available. `ctx.db.get` in test helpers is allowed when no caller-facing query exposes the asserted state.

Lint rejects recognized module-mocking calls in `convex/tests/**` and imports of `convex/test.setup` from Convex lib test directories; it cannot establish test value or interface quality. Apply the admission and refactor checks even when lint passes.

## Placement and comments

- Put frontend Vitest files in `src/sites/studio/features/<feature>/tests/`, not implementation `lib/` directories.
- Maintain one file-level comment describing each test, with a short subheading and a description on the next line. Keep these comments at the top of the file, rather than immediately above individual tests.

## E2E

Add E2E only for critical customer-facing behavior that passes the admission rule. Create and verify state through the UI; do not seed behind the app.

Preserve the CI session and package checkout tests, which open checkout without completing payment because of Stripe hCaptcha. Local payment, reschedule, and package-scheduling specs protect distinct behavior.

## Convex tests

Before choosing Convex test placement, fixtures, or Stripe, Google SDK, PDF, and email stubs, read [boundary-testing.md](references/boundary-testing.md).

Use `createConvexTest` and call registered queries, mutations, or actions through generated `api` or `internal` references. Internal job, webhook, and function entrypoints can be meaningful interfaces. Keep handlers, services, and lib separate; tests can exercise those layers through an entrypoint without collapsing them.
