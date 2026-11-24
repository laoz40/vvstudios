# 02: Admin dashboard and initial delivery

**What to build:** Let admins open the edits for a session, see which edits are in studio review, and send an individual edit to the client when the files are ready.

**Blocked by:** 01 (Editor dashboard and initial delivery).

**Status:** ready-for-agent

See the [client revisions spec](spec.md) for the full workflow.

- [x] In the admin Sessions table, click the Deliverables badge or an open area of a session row to expand its edits. Include legacy assignments moved to the per-edit workflow. The inset list shows each edit’s name, status and due date, including **Studio review** for a studio handoff. Keep the editor name under the badge. Show the number in review first, otherwise show how many edits are sent. When all edits are sent, use **All sent**.
- [x] The studio notification opens the main dashboard. From the expanded edits list, an admin can use **Send deliverables** even if the editor has yet to mark the edit ready for studio review. The admin checks that the files are ready. The confirmation identifies the edit and accepts optional notes. The email names the edit and includes the Drive link.
- [x] Remove **Mark as sent** and **Keep editing** from the per-edit send dialog. The app updates the overall session status automatically.
- [x] The server verifies admin access, the session and edit, and delivery eligibility. Preserve the existing Drive-link and delivery-email checks.
- [x] A successful send records client delivery for the selected edit only. A failed send leaves it available for retry. The client delivery time comes from the successful email, even if the studio received the handoff earlier.
- [x] Admins can use **Send deliverables** again on an edit marked **Sent**, including after the session completes. A failed resend preserves the previous delivery.
- [x] Send the Drive link without a feedback link or revision instructions during this rollout. Show **Sent** after each successful delivery and complete the session automatically when the last edit is sent. These deliveries stay final when client revisions launch. See the [session status rules](spec.md#edits-and-dashboard) for deliveries after launch.
- [ ] Verify that an editor who lacks client-send permission can hand off an edit and an admin can finish the delivery. The Contractors permission toggle and indicator remain in use.
