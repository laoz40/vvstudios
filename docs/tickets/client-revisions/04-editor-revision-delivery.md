# 04: Editor dashboard and revision delivery

**What to build:** Let assigned editors see requested work, read each round's feedback, and send or hand off the export for one specific round. Keep the session in the queue until outstanding work and client review windows are closed.

**Blocked by:** 03 (Private feedback page and free rounds).

**Status:** ready-for-agent

See the [client revisions spec](spec.md) for the full workflow.

- [ ] The editor dashboard shows the blue revision count on the session row and **Client revisions** and **Feedback** in the expanded edit table. **View feedback** is read-only and groups timestamped feedback by round, with its number, status and clip numbers where applicable.
- [ ] In the **Edits** tab, an **All sent** session with an open window for new revision requests shows “The client can request revisions until [date].” next to **All sent**. Use the latest deadline among edits that can still receive a new request.
- [ ] A round is due by 11:59 pm Sydney time on the second business day after it reaches the editor. An edit with multiple open rounds shows the earliest due date. The session's sortable **Due** column reflects the nearest unfinished work across original edits and revisions.
- [ ] An approved editor who has uploaded the revised files to Drive can use **Send revision** from the edit status dropdown. The confirmation identifies one open client-submitted round and accepts optional notes. Each round has its own export and send.
- [ ] An editor without client-send permission can hand off a specific round with **Send for review**. The studio receives an email and staff see **Studio review**. The handoff preserves the last client delivery time. The server checks assignment, permission, edit and round eligibility.
- [ ] A successful client email includes the Drive and private feedback links and delivers only the confirmed round. Other open rounds keep their own deadlines, including rounds submitted while the editor exports or confirms the send. When no requested work remains, show **Client review** while the client's window is open and **Sent** once it closes. A failed email keeps the round and previous delivery time available for retry.
- [ ] A successful revision send starts a new two-business-day window if eligible. The session stays in editing while work remains and in review while any client window is open. A scheduled recheck uses current delivery times, open rounds and eligibility before moving to completed. If a revision is requested on an already-archived session, unarchive it so it returns to the active dashboard queue.
- [ ] Verify the editor workflow using two open rounds on one edit. Deliver one and check the other stays open. Enable the full production feedback flow with ticket 05 so the studio can fulfil handoffs.
