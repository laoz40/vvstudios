# 01: Editor dashboard and initial delivery

**What to build:** Give editors one row per session and show each purchased edit within that row. Let them deliver each edit or hand it off for studio review after uploading the files to Drive.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

See the [client revisions spec](spec.md) for the full workflow.

- [ ] New assignments with editing add-ons show one edit per purchased unit, including one edit per Clip Volume Pack unit. Label repeated units by episode and track each package session independently.
- [ ] One editor owns all edits in the session. The admin sets one original due date at assignment, with a default of six days after the session. Reassignment preserves delivery and revision eligibility. Sessions without editing add-ons retain their single status.
- [ ] At rollout, sessions with a saved editor assignment and unfinished editing work show their edits in the same expandable row with the same arrow controls as new assignments. Start each edit at **Not started** and carry over the assigned editor and any saved due date. Leave completed sessions in **History**. Retrying rollout creates no duplicate edits, and rollout sends no emails.
- [ ] The editor dashboard shows one expandable row per session. Show session date and time, Admin Notes, Editor Notes and Drive on that row, and remove the Service column. Use the yellow **Edits due** badge and muted **All sent** label. Display the nearest unfinished due date in a separate sortable **Due** column with relative time and existing urgency colours.
- [ ] The expanded table identifies each edit and shows its own status and due date. Use the arrow controls to move between **Not started**, **Downloading**, **Editing**, and **Uploading**. Starting **Downloading** opens the session's Drive folders. Show **Sent** after client delivery and **Studio review** for a studio handoff. Preserve the session edit status used by existing dashboard, email and editor-count consumers.
- [ ] After manually uploading the files, an approved editor can click **Send to client** for a non-legacy edit. The confirmation identifies that edit and accepts optional notes. The email names the edit and includes its Drive link. Preserve the applicable Drive-link and delivery-email checks.
- [ ] An editor without client-send permission or working on a legacy edit can use **Send for review** for that edit. A successful handoff emails the studio and shows **Studio review** to staff. The server enforces assignment, permission, edit identity and status, including studio-only handoff for legacy edits. Handing off leaves client delivery unchanged.
- [ ] Only a successful client email records delivery. An email failure leaves the prior state available for retry. Editors cannot resend an already delivered edit using the initial-send action.
- [ ] Verify direct delivery and studio handoff independently. Coordinate customer rollout of the two permission paths with ticket 02. Add the client feedback link and revision instructions to delivery emails with ticket 03.

### Production rollout

Release tickets 01 and 02 to production together. Verify direct client delivery on a new assignment and per-edit studio handoff through admin delivery on a legacy assignment. Tell editors that unfinished assignments will open in the new UI with their edits at **Not started**.
