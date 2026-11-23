# 01: Editor dashboard and initial delivery

**What to build:** Give editors one row per session and one job per purchased edit. Let them deliver each edit or hand it off for studio review after uploading the files to Drive.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

See the [client revisions spec](spec.md) for the full workflow.

- [ ] New assignments with editing add-ons show one job per purchased unit, including one job per Clip Volume Pack unit. Label repeated units by episode and track each package session independently.
- [ ] One editor owns all jobs in the session. The admin sets one original due date at assignment, with a default of six days after the session. Sessions already assigned at rollout finish in the existing flow, and reassignment preserves the chosen flow. Sessions without editing add-ons retain their single status.
- [ ] The editor dashboard shows one expandable row per session. Show session date and time, Admin Notes, Editor Notes and Drive on that row, and remove the Service column. Use the yellow **Edits due** badge and muted **All sent** label. Display the nearest unfinished due date in a separate sortable **Due** column with relative time and existing urgency colours.
- [ ] The expanded table identifies each edit and shows its own status and due date. It supports **Not started**, **Editing**, **Sent**, and the existing staff **Review** label for a studio handoff. Preserve the session edit status used by existing dashboard, email and editor-count consumers.
- [ ] After manually uploading the files, an approved editor can use **Send to client** in the edit's status dropdown. The confirmation identifies that edit and accepts optional notes. The email names the edit and includes its Drive link. Preserve the applicable Drive-link and delivery-email checks.
- [ ] An editor without client-send permission can use **Send for review** for that edit. A successful handoff emails the studio and shows **Review** to staff. The server enforces assignment, permission, edit identity and status. Handing off leaves client delivery unchanged.
- [ ] Only a successful client email records delivery. An email failure leaves the prior state available for retry. Editors cannot resend an already delivered edit using the initial-send action.
- [ ] Verify direct delivery and studio handoff independently. Coordinate customer rollout of the two permission paths with ticket 02. Add the client feedback link and revision instructions to delivery emails with ticket 03.
