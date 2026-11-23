# 02: Admin dashboard and initial delivery

**What to build:** Let admins open the edits for a session, see which edits the studio needs to review, and send a reviewed edit to the client.

**Blocked by:** 01 (Editor dashboard and initial delivery).

**Status:** ready-for-agent

See the [client revisions spec](spec.md) for the full workflow.

- [ ] The admin Sessions table offers an **Edits** action on sessions using per-edit tracking. It opens a list of that session's edits so admins can identify the edit and see its status and due date, including the existing **Review** label for a studio handoff.
- [ ] Starting with a studio notification from ticket 01, an admin can find the handed-off edit and use **Send deliverables** to send that edit. The confirmation identifies the edit and accepts optional notes. The email names the edit and includes the Drive link.
- [ ] The server verifies admin access, the session and edit, and delivery eligibility. Preserve the existing Drive-link and delivery-email checks.
- [ ] A successful send records client delivery for the selected edit only. A failed send leaves it available for retry. The client delivery time comes from the successful email, even if the studio received the handoff earlier.
- [ ] Verify that an editor who lacks client-send permission can hand off an edit and an admin can finish the delivery. The Contractors permission toggle and indicator remain in use.
