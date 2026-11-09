# Test proposals

Candidates for periodic user review. Entries are proposals, not approval to write tests. The user chooses which items to implement.

Append one checklist item per distinct failure using this format. Describe behavior, not a proposed helper test:

```markdown
- [ ] <Behavior or risk>
  - Failure and consequence: <plausible bug and impact on customers or operations>.
  - Observable result: <existing module entrypoint and exact outcome to assert>.
  - Coverage gap: <why existing tests and static checks miss this failure>.
```

For a proposed rewrite or removal, name the existing test, explain its defect or implementation coupling, and identify meaningful coverage to preserve.

Check for an equivalent proposal before adding an item. Keep unapproved entries pending. Check an item only after the user approves it and the approved change is completed.

## Pending proposals

- [ ] Update delivery permission coverage for the restored admin-review path.
  - Failure and consequence: permission routing could notify the admin after direct client delivery, or leave an editor without permission unable to request admin review.
  - Observable result: through the existing delivery action and status mutation, an editor without client-send permission can enter review and schedule the admin notification but cannot email the client; an enabled editor can send to the client and enter review without scheduling an admin notification. Repeating the review status must not schedule a second notification.
  - Coverage gap: the user-approved correction in `convex/tests/deliverablesEmail.test.ts` now permits review without client-send permission while preserving direct-send and completed-status denial. Admin notification scheduling and repeat-review deduplication remain unapproved coverage candidates. Do not restore the redundant Drive-link variants or helper-only tests.

- [ ] Count only confirmed bookings when assigning Drive session folder numbers.
  - Failure and consequence: Earlier unpaid, expired, abandoned, or failed booking attempts can inflate the first real session's folder prefix, confusing clients and staff.
  - Observable result: Call `internal.sessions.drive.allocateClientSessionNumber` and `internal.sessions.drive.allocatePackageSessionNumber` with earlier unconfirmed attempts and two confirmed sessions; the confirmed sessions receive numbers `1` and `2` in date order.
  - Coverage gap: Existing Drive allocation tests cover date order, email linking, and cancellation cleanup, but do not cover earlier unconfirmed attempts. Static checks cannot detect an incorrect prefix.

- [ ] Preserve and charge all selected editing and clip services together.
  - Failure and consequence: Selecting or saving a second editing or clip service could silently discard another service or its quantity, leaving the booking and invoice incomplete.
  - Observable result: Submit a booking and save an admin session edit with Rough Cut, Complete Edit, Clip Volume Pack, and Handcrafted Clips at different quantities; all four services and their quantities persist and the invoice charges each selected quantity.
  - Coverage gap: Existing pricing cases cover individual editing selections, but do not cover combined selections surviving booking validation and admin editing. Static checks cannot detect silent deselection.
- [ ] Delivering one part can restart the editor assignment without suppressing its notification.
  - Failure and consequence: a session's previous sent assignment email suppresses the next round's email, leaving the editor unaware of more work.
  - Observable result: call `api.sessions.admin.restartSessionEditing` after a prior sent assignment, then run the scheduled editor access job. The booking has `to_edit` and the new due date, and the outgoing assignment email carries that date with a distinct idempotency key.
  - Coverage gap: current Drive tests cover initial assignment and stale email results, but do not exercise a new delivery round after a sent notification. Static checks cannot detect email-provider deduplication.

- [ ] Browse every active or retired contractor beyond the former 200-profile cap.
  - Failure and consequence: Retired verification profiles can consume an unfiltered limit and hide active editors from admins, or pagination can omit matching contractors.
  - Observable result: Query `api.employees.admin.listEmployees` across cursors with mixed active and retired profiles exceeding 200 records. Each status returns all matching profiles exactly once and excludes the other status.
  - Coverage gap: The existing retirement test checks access changes and workload, but does not cover capped roster reads or pagination. Static checks cannot detect missing records.

- [x] Replace obsolete admin review notification coverage with direct client delivery coverage.
  - Failure and consequence: editor delivery could update the session to review after an email failure, making staff believe the client received files when they did not.
  - Observable result: call the deliverables email action with client notes, then the existing status mutation; the email includes the notes and Drive link, the session becomes review without an admin notification, and a failed email action returns its reason while preserving status and saved notes.
  - Coverage gap: `convex/tests/deliverablesReviewEmail.test.ts` and `convex/shared/lib/tests/deliverablesReviewNotification.test.ts` assert the replaced host notification behavior. Approved replacement coverage in `convex/tests/deliverablesEmail.test.ts` exercises the real actions, mutations and email rendering with external transport stubs. Browser sequencing remains outside these tests.

- [x] Enforce per-editor client delivery permission and revocation.
  - Failure and consequence: a default or revoked editor could email clients or mark delivery complete via a status mutation without admin authorization.
  - Observable result: the approved delivery endpoint tests prove default denial, admin-only enable/revoke, rejection of direct-send and completed status updates without permission, and continued access to editing and admin-review status updates.
  - Coverage gap: prior delivery tests assumed all editors could send and did not exercise per-editor permission changes. Approved cases now exercise the existing access query and registered permission, send and status endpoints.
