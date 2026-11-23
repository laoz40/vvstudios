# 05: Admin dashboard and revision delivery

**What to build:** Let admins read feedback from the session's **Edits** action and send the specific round an editor has handed off for studio review.

**Blocked by:** 02 (Admin dashboard and initial delivery), 04 (Editor dashboard and revision delivery).

**Status:** ready-for-agent

See the [client revisions spec](spec.md) for the full workflow.

- [ ] In Sessions, the **Edits** action shows the session's individual edits and their revision state. An admin can select an edit and read its feedback grouped by round, including round number, status, timestamps, notes and clip numbers where applicable.
- [ ] **View feedback** leaves the edit and rounds unchanged. Admins follow client requests in the dashboard. The separate notification for a studio handoff still reaches the studio.
- [ ] Starting with an editor's revision handoff, the admin can identify the round ready for studio review and send it to the client with optional notes. The server checks admin access, the session and edit, and that the selected round is eligible for delivery.
- [ ] The successful client email includes the Drive and private feedback links. It marks only the selected round delivered, preserves other open rounds and renews that edit's window if eligible. A failed email keeps the round available to retry and preserves the previous delivery time.
- [ ] Verify the handoff and send with a second open round on the edit. The sent round follows the same completion rules as a round delivered by an approved editor.
