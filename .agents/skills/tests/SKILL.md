---
name: tests
description: Use before proposing, writing, updating, or reviewing tests.
---

# Testing

Follow lean, risk-based behavioral testing: maintain the smallest test suite that provides meaningful confidence in core application functionality.

## Principles

- Behavior-driven: test what the application does, not how it is implemented.
- Black-box: assert outcomes visible to the user, not internal state or implementation details.
- Risk-based: focus on realistic failures with meaningful consequences, such as incorrect charges, scheduling conflicts, lost bookings, unauthorized access, or duplicate processing.
- Minimal test suites: avoid redundant tests, trivial checks, speculative edge cases, tautological assertions, and coverage targets. Add tests only for meaningful regressions not already adequately covered. It is OK not to add a test after making a change.

## Test selection priority

1. Critical user journeys: essential workflows, such as booking and paying for a studio session, then finding the confirmed booking.
2. Feature-level behavior: consequential interactions, such as rescheduling a session and seeing the new time reflected in the booking, or scheduling sessions from a purchased package.
3. High-risk business logic: rules where incorrect results would charge customers incorrectly, cause scheduling conflicts, or expose customer data, such as pricing selected services or enforcing staff permissions.

These examples guide selection; they are not a checklist of tests to add.

## Test level and workflow

- Use E2E tests only. Cover feature behavior and business rules through observable UI outcomes, preferably within existing user journeys rather than separate tests for every rule.
- Do not introduce unit or integration tests without explicit user approval and a concrete risk that E2E cannot adequately or practically verify.
- Don't write new tests without explicit user approval. Instead record candidates in [test proposals](../../../docs/test-proposals.md) and continue implementation. Remember it's ok to not add a test for each change.
- Before selecting E2E flows or verifying browser behavior, read the [verification skill](../verify-vvstudios/SKILL.md) for commands, browser prerequisites, and evidence requirements.
- Preserve the CI session and package checkout tests, which open checkout without completing payment because of Stripe hCaptcha. Local payment, reschedule, and package-scheduling specs protect distinct behavior.

## Test file comments

- At the top of every test file, maintain one file-level comment that describes each test.
- Give each test a short subheading with its description on the next line.

## Test proposal format

Give each proposal a short descriptive heading and include:

- Behavior: what application behavior would this test protect?
- Regression: what realistic failure would it catch?
- Risk: a consequence score from 1 to 10, with a brief justification. Score impact, not likelihood: 1 means a minor inconvenience; 10 means severe harm, such as unrecoverable loss of booking records or major unauthorized charges.
- Gap: why is existing coverage insufficient? Identify the relevant tests or state that no coverage exists.
- Level: the proposed test level and why it is the simplest effective choice. E2E is the default. Propose integration or unit tests only when necessary, explaining why E2E cannot adequately or practically verify the behavior.

Check existing coverage and proposals first. Extend an equivalent proposal rather than adding a duplicate.

## Approved unit and integration tests

Test meaningful module behavior through existing interfaces, not internal helpers or collaborator calls. Keep internal collaborators real and stub only external boundaries. Do not add wrappers, exports, or production entrypoints solely for tests.

- Put frontend Vitest files in `src/sites/studio/features/<feature>/tests/`, not implementation `lib/` directories.
- For approved Convex unit or integration work, including updates to existing tests, read [boundary-testing.md](references/boundary-testing.md) before choosing placement, fixtures, or external-service stubs. Follow its endpoint and pure-module conventions.
