# Test proposals

Candidates for periodic user review. Entries are proposals, not approval to write tests. The user chooses which items to implement.

Use a short descriptive heading for each distinct failure:

```markdown
### <Short descriptive heading>

- Behavior: <application behavior protected and observable outcome>.
- Regression: <realistic failure the test would catch>.
- Risk: <1–10 consequence score and brief justification; score impact, not likelihood>.
- Gap: <why existing coverage is insufficient; identify relevant tests or state that none exist>.
- Level: <simplest effective test level and why; for unit or integration tests, explain why E2E cannot adequately or practically verify the behavior>.
```

E2E is the default. Proposals do not authorize new tests or new test levels. For a proposed rewrite or removal, name the existing test, explain its defect or implementation coupling, and identify meaningful coverage to preserve.

Check for an equivalent proposal before adding an entry. Keep unapproved entries pending. Remove a proposal after the user approves it and the approved change is completed.

## Pending proposals

### Detect Convex dependency lint bypasses

- Behavior: `checkConvexLayers` reports reversed layer dependencies and misplaced endpoint registration through aliases, barrels, namespace exports, dynamic imports, and registrar aliases, while allowing type-only imports and generated API references.
- Regression: a renamed import or re-export hides an architectural violation from the dependency check.
- Risk: 4/10. Undetected violations weaken maintainability and enforcement of backend boundaries, but do not themselves demonstrate customer data loss or incorrect charges.
- Gap: existing Oxlint handler-import and service-re-export cases cover direct imports and simple exports only. No existing cases exercise the standalone dependency check or resolved provenance through these bypasses.
- Level: unit tests of the dependency check with representative source inputs. Browser E2E cannot verify source-level lint diagnostics or distinguish allowed imports from forbidden dependencies.

### Preserve delivery permissions and admin-review notifications

- Behavior: an editor without client-send permission can request admin review and trigger its notification but cannot email the client. An enabled editor can deliver directly without an admin notification. Repeating the review status does not send another notification.
- Regression: permission routing blocks a legitimate review request, notifies the admin after direct delivery, or sends duplicate review notifications.
- Risk: 6/10. Editors can be blocked from handing off work, and incorrect or repeated notifications can disrupt studio review and delivery.
- Gap: the approved correction in `convex/tests/deliverablesEmail.test.ts` permits review without client-send permission while preserving direct-send and completed-status denial. Admin notification scheduling and repeat-review deduplication remain uncovered. Do not restore redundant Drive-link variants or helper-only tests.
- Level: extend existing Convex endpoint integration coverage through the delivery action and status mutation, with external email transport stubbed. UI-only E2E cannot reliably establish the absence of duplicate external notifications without observing email delivery outside the app.

### Number Drive folders using confirmed bookings only

- Behavior: confirmed client and package sessions receive folder numbers `1` and `2` in date order despite earlier unpaid, expired, abandoned, or failed booking attempts.
- Regression: unconfirmed attempts inflate the first real session's folder prefix.
- Risk: 3/10. Incorrect numbering confuses clients and staff organizing session files, but does not itself lose files or bookings.
- Gap: existing Drive allocation tests cover date order, email linking, and cancellation cleanup, but not earlier unconfirmed attempts. Static checks cannot detect an incorrect prefix.
- Level: extend existing Convex integration coverage through `internal.sessions.drive.allocateClientSessionNumber` and `internal.sessions.drive.allocatePackageSessionNumber`. The folder-numbering result belongs to an external Drive workflow; verifying every failed-booking variant through browser checkout and live Drive would be impractical.

### Preserve combined editing and clip selections

- Behavior: a booking and a subsequent admin session edit retain Rough Cut, Complete Edit, Clip Volume Pack, and Handcrafted Clips at different quantities, and the invoice charges each selected quantity.
- Regression: selecting or saving a second service silently discards another service or its quantity, leaving the booking and invoice incomplete.
- Risk: 7/10. Missing selections can produce incorrect charges and leave customers without purchased editing services.
- Gap: existing pricing cases cover individual editing selections, but not combined selections surviving booking validation and admin editing. Static checks cannot detect silent deselection.
- Level: E2E, preferably extending an existing booking and admin-edit journey. Select the services through the UI, read back the saved selections after each save, and verify the resulting invoice quantities and charges through the UI.

### Notify editors when an assignment restarts

- Behavior: restarting editing after a prior sent assignment restores the session to `to_edit`, saves the new due date, and sends an assignment email with that date and a distinct idempotency key.
- Regression: the prior assignment email suppresses the next round's notification, leaving the editor unaware of more work.
- Risk: 6/10. Missed assignments can delay editing and cause delivery deadlines to be missed.
- Gap: current Drive tests cover initial assignment and stale email results, but not a new delivery round after a sent notification. Static checks cannot detect email-provider deduplication.
- Level: extend existing Convex integration coverage through `api.sessions.admin.restartSessionEditing` and the scheduled editor access job, with external email transport stubbed. Browser E2E cannot adequately verify provider deduplication or the outgoing idempotency key through app UI alone.

### Browse all active and retired contractors

- Behavior: admins can browse every contractor matching the selected status, without omissions, duplicates, or contractors from the other status, even when the mixed roster exceeds 200 profiles.
- Regression: retired profiles consume an unfiltered limit and hide active editors, or pagination skips matching contractors.
- Risk: 5/10. Missing editors can prevent admins from finding available staff and assigning work.
- Gap: the existing retirement test checks access changes and workload, but not capped roster reads or pagination. Static checks cannot detect missing records.
- Level: E2E through the contractor roster and its status filters. A mixed roster exceeding 200 profiles must be created through the UI, so the setup cost should be considered during approval rather than bypassed with backend seeding.
