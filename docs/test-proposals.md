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
