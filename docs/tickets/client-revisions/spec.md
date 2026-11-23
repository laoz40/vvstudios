# Client revisions

## Problem statement

The studio passes feedback between clients and editors over email, texts and calls. Staff copy timestamped feedback into new messages and track which version went out, who owes a reply, and whether another round is free. A session can have several edits that go out on different days, while the dashboard tracks delivery at the session level. Each extra round can mean another edit and export, so clients need a clear deadline and a way to group changes for each deliverable.

## Solution

Track each purchased edit as its own job within the session. Send the client a Drive link when the edit is delivered and include a private feedback link when the edit is eligible for revisions. The client can submit timestamped feedback, and their assigned editor receives the request and sees it on the dashboard. Additional rounds go through Stripe Checkout. Editors upload files to Drive and send the revision from the dashboard. The studio reviews legacy edits and edits from editors who lack client-send permission.

## User stories

1. As an admin, I want to assign one editor to a session, so that the same person handles all its edits.
2. As an admin, I want to set one original due date at assignment, so that all edits start with the same deadline.
3. As an editor, I want all purchased edits to appear when I receive a session assignment, so that I can plan the work.
4. As an editor, I want one expandable row per session, so that I can scan my queue and open the details I need.
5. As an editor, I want the session date, time, Admin Notes, Editor Notes and Drive link on the session row, so that I can find the shared context.
6. As an editor, I want repeated add-on units labelled by episode, so that I can tell jobs of the same type apart.
7. As an editor, I want a count of edits still due and a separate revision count, so that I can spot outstanding work.
8. As an editor, I want a sortable Due column with a relative date and urgency colours, so that I can prioritise my work.
9. As an editor, I want to see each edit's status, due date and client revisions, so that I know what to do next.
10. As an editor, I want sessions without edit add-ons to retain their single status, so that I can handle them as before.
11. As an admin, I want to control client-send permission per editor, so that I can decide which editors need studio review.
12. As an admin, I want to see which editors have client-send permission on Contractors, so that I can check who can deliver.
13. As an approved editor, I want to send one edit at a time after uploading it, so that the client can start reviewing as soon as it is ready.
14. As an editor who needs studio review, I want to flag one edit as ready and notify the studio, so that an admin can check it.
15. As an admin, I want to send the reviewed edit to the client, so that I can control the final delivery.
16. As an editor or admin, I want to add optional notes when sending an edit, so that I can explain anything the client needs to know.
17. As an editor or admin, I want a failed email to leave delivery pending, so that I can retry it.
18. As a client, I want the email to name the edit and include its Drive link and revision rules, so that I know what arrived and how to review it.
19. As a client, I want to open the private feedback link from my email without logging in, so that I can send changes directly.
20. As a client, I want to see the edits I bought for that session, so that I can find the right job.
21. As a client, I want to see which edit has arrived and when its feedback is due, so that I can review each delivery in time.
22. As a client with several package sessions, I want a separate allowance and deadline for each edit in each session, so that one delivery does not use another's allowance.
23. As a client, I want to see whether the next round is Free, $50 or Closed, so that I know my options before filling in the form.
24. As a Rough Cut or Clip Volume Pack client, I want to know which corrections are included, so that I can use my free round appropriately.
25. As a Complete Edit or Handcrafted Clips client, I want to know how many rounds are included and that stylised changes are allowed, so that I can plan my feedback.
26. As a client, I want to enter a timestamp and note for each change, so that the editor can find each moment.
27. As a clip client, I want to specify a clip number and group feedback for the pack in one round, so that the editor can address the clips together.
28. As a client, I want a link to the Drive assets folder, so that I can share reference files there.
29. As a client, I want to send another round while my window and allowance are open, so that I can add changes even if an earlier round is pending.
30. As a client, I want to pay the disclosed $50 AUD including GST in Stripe Checkout, so that I can request another round after using my free allowance.
31. As a client, I want an abandoned checkout to leave my allowance intact, so that I can return before my deadline.
32. As an editor, I want an email when a client submits a free round or pays for an extra round, so that I can start the work.
33. As an editor, I want the request email to name the client, session and edit and include timestamped feedback and a dashboard link, so that I can open the right job.
34. As an editor, I want the due date to reflect the revision turnaround, so that I can prioritise it against original edits.
35. As an editor or admin, I want to read feedback grouped by round, so that I can see the history and which requests are still open.
36. As an editor, I want to open feedback without changing the edit's status, so that I can refer to it as I work.
37. As an approved editor or admin, I want to send the revision for a specific round after uploading its export to Drive, so that the client knows which changes are ready.
38. As an editor who needs studio review, I want an admin to handle the client send for revisions, so that the same delivery permission applies.
39. As a client, I want a fresh window after a revision is delivered if I have rounds left, so that I can review the new version.
40. As a studio admin, I want paid revisions to become actionable only after Stripe confirms payment, so that staff actions cannot unlock paid work.
41. As an admin, I want a session to complete automatically once the review windows have closed and the work is done, so that the queue reflects what still needs attention.
42. As a client, I want to reopen an unpaid Checkout from my feedback page, so that I can finish paying if I close the original tab.

## Implementation decisions

### Current workflow on dev

PR #203 already added the per-editor client-send permission. The admin toggles it in the Contractors action dropdown, and the Contractors list shows an indicator beside enabled editors. The permission is off by default and enforced server-side.

The session-level workflow lets an approved editor choose **Send to client** to email the session's Drive link and optional notes. An editor without permission can choose **Send for review** to notify the studio, and an admin can use **Send deliverables**. The same session-level review status could follow either editor action. The new workflow records delivery per edit after the client email succeeds.

### Rollout for existing assignments

- At rollout, create one job per purchased editing add-on unit for sessions with a saved editor assignment and unfinished editing work. Use the same expandable editor row and per-edit arrow controls as for new assignments. Apply this per session, including sessions within a package.
- Start each legacy job at **Not started**. Carry over the session's assigned editor and due date, using the normal default if no due date is saved. Leave completed sessions in **History**. Keep the existing single-status flow for sessions without editing add-ons.
- Legacy jobs always go through **Send for review**. Each handoff notifies the studio for that edit and shows **Studio review**. An admin sends that edit to the client, after which it shows **Sent**. The server enforces the studio handoff even when the assigned editor has client-send permission.
- Legacy deliveries include the Drive link and have no private feedback link, client review window, or free or paid revision rounds. The session completes once all its edits are sent.
- Preserve the session's delivery and revision eligibility when its editor changes. A session unassigned at rollout enters the normal workflow when assigned. Make job creation safe to retry and avoid inferring per-edit delivery history or sending emails during rollout.

### Jobs and dashboard

- Create one edit job per purchased unit of an editing add-on in a session. Label repeated units by episode. Each Clip Volume Pack unit is one edit. Each package session has its own jobs, deadlines and revision allowances.
- Assign all edit jobs to the session's editor at the same time. The admin sets one original due date at assignment. The default is six days after the session. An actionable round is due by 11:59 pm Sydney time on the second business day after it reaches the editor. When an edit has multiple open rounds, show the earliest due date.
- The editor's list has one expandable row per session. Show session date and time, Admin Notes, Editor Notes and Drive at the session level. Remove the Service column. Use a yellow **Edits due** badge, a blue revision count, and a muted **All sent** label when every edit has been sent and no revision work is pending.
- The separate **Due** column shows the nearest unfinished due date in relative time. Keep urgency colours and sort by the underlying due date. The expanded edit table has its own headings for Status, Edit, Due, Client revisions and Feedback.
- Use the next-step button to advance each edit from **Not started** through **Downloading**, **Editing** and **Uploading**. Starting **Downloading** opens the session's Drive folders. In the editor dashboard, use **Studio review** for a pending studio handoff, **Client review** while a delivered edit has an open revision window and no requested work, **Revision requested** for new revision work and **Sent** for delivered edits without an open window or requested work.
- Derive the session status from its edits. Use `to_edit` when all are not started. Use `editing` when there is unfinished work after work has started, including a studio handoff, an open revision or a mix of sent and not-started edits. When all edits are delivered and no requested work remains, use `review` while a client window or eligible Checkout is open, then `completed` once they have closed.
- Preserve the session-level `editStatus` contract for existing dashboard, email and editor-count consumers. A studio review handoff and a client review window need distinct records even where existing consumers still read a session status.
- Schedule a recheck when client review windows close. If an eligible Checkout is still open, recheck when it expires or payment is confirmed. Check current delivery times, outstanding rounds and eligibility again before completing the session.

### Initial delivery and studio review

- Send one edit at a time using its next-step button at **Uploading**. The editor uploads the finished files to Drive by hand before sending. Confirm the selected edit and offer optional notes.
- For client delivery, check the actor's permission, assignment where applicable, edit identity, delivery eligibility and current status on the server. An approved editor uses **Send to client** on a non-legacy edit. The admin uses **Send deliverables** for the selected edit after studio review. Preserve the applicable Drive-link and delivery-email variant checks.
- The client email names the edit and includes the Drive link. For revision-eligible edits, include the timestamp format, private feedback link, revision rules, free allowance, price and cap.
- An editor without client-send permission or working on a legacy edit uses **Send for review** for that edit. It emails the studio and shows **Studio review** to staff. For eligible edits, the client's page still shows **Not delivered yet** before the first client email. A studio handoff leaves the client delivery time and window unchanged.
- Record delivery only after the client email succeeds. Start a client review window for revision-eligible edits. If the email fails, leave the delivery state unchanged and allow a retry. Editors can send again only by fulfilling a client-submitted revision.

### Client feedback and allowances

- The private link opens the session's feedback page without an account. Show only purchased edits, grouped by add-on and identified by unit or episode when repeated. Include the Drive assets folder link.
- Show **Not delivered yet** for unsent edits. For an open edit, show **Request changes by [date]** and the **Free** or **$50** badge that applies to the next request. Show **Closed** for new requests after expiry or when the allowance is exhausted. Keep **Resume payment** available for any eligible Checkout still open. The editor's turnaround belongs in the dashboard.
- The client can start a request through 11:59 pm Sydney time on the second business day after the most recent successful delivery of that edit, including a revision delivery. Count Monday to Friday and ignore public holidays. A revision already requested on time can still be fulfilled and starts a new window if the edit has rounds left.

| Purchased edit | Free rounds | Included changes |
| --- | ---: | --- |
| Rough Cut (internal add-on key Essential Edit) | 1 | Corrections to cuts, timing and text errors |
| Clip Volume Pack | 1 | Corrections to cuts, timing and text errors |
| Complete Edit | 2 | Stylised changes allowed |
| Handcrafted Clips | 2 | Stylised changes allowed |

- Each edit can have five paid rounds after its free allowance. Each paid round costs $50 AUD including GST. This matches the booking terms on `dev`.
- Submit feedback for one edit per round. Each row contains a timestamp and note, plus a clip number for clip add-ons. **Add another** adds a row. Group the clip pack's changes into the same round. Explain correction-only rules in the copy.
- Allow multiple rounds during an open window, even while earlier rounds are pending. Count each accepted round separately. The server validates the token, purchased edit, delivery and window, remaining allowance and feedback fields. A client cannot submit on an unsent, expired or exhausted edit.
- A valid free submission records an actionable round, sets the edit to **Revision requested**, and emails the assigned editor with the client, session, edit, feedback rows and dashboard link. Admins follow revision requests and deliveries in the dashboard. The studio review email remains a separate notification.

### Paid rounds

- When no free rounds remain, use Stripe Checkout for the next eligible request. Set the price and match the Checkout session to the edit and its submitted feedback server-side. Allow one unpaid Checkout per edit at a time so a retry or second tab cannot collect payment twice for the same request or sell the last available paid round twice.
- Use a 30-minute Stripe Checkout expiry. Show **Resume payment** on the feedback page while Stripe reports the existing Checkout open. Redirect to the same hosted Checkout URL even from another tab.
- A Checkout started before the client deadline can finish after the deadline, within its own short payment window. The request deadline still gates starting a new Checkout. Keep the session eligible for work until a valid pending Checkout pays or expires.
- Only confirmed payment processed by the webhook makes the round actionable, advances the count, sets the edit to **Revision requested**, and triggers the editor email and turnaround. An expired unpaid Checkout frees the slot. The client can start again if they still have time and allowance. Repeated webhook delivery must apply the payment and request once.
- Employee status changes and delivery actions cannot create or unlock a paid round.

### Feedback and fulfilment

- Assigned editors and admins can read the edit's feedback grouped by round. Show the round number, timestamped rows, clip number where applicable, and round status. Free or paid classification is unnecessary in the staff view.
- On the admin Sessions table, add an **Edits** action to the session row. It opens that session's edit list, where the admin can select an edit and view its feedback.
- **View feedback** is read-only. **Send revision** is a separate action in the edit status dropdown and requires an open client-submitted round. Each round has its own export and delivery. Upload the revised files to Drive, identify the round being delivered and confirm the send with optional notes.
- An approved editor can send the revision to the client. An editor without permission uploads the revised files and uses **Send for review** for that round. Show **Studio review** and email the studio. The admin sends that round's revision to the client from the session row's **Edits** action.
- On a successful send, email the client that the revision is ready with the Drive and private feedback links. Mark the confirmed round delivered. Other rounds remain open with their own due dates, including any round that arrives while the editor is exporting the files or confirming the send. Each successful delivery starts a new two-business-day window if the edit remains eligible. Once no requested work remains, show **Client review** while the window is open and **Sent** once it closes. A failed send leaves the round and last delivery time unchanged.

### Data and service boundaries

- Use the booking's selected editing add-ons and quantities as the source for the edit list. Keep a stable identity per session, add-on and unit so delivery, payment and feedback attach to the same edit.
- Record delivery and revision eligibility per session. Legacy and new assignments use the same edit job records. Enforce revision eligibility across delivery emails, feedback links, submissions and Checkout. Existing session-level statuses cannot establish delivery for an individual edit.
- Store each edit's status and last client delivery time. A revision round records its edit identity, timestamped feedback, optional clip number, request time, lifecycle and Checkout reference when applicable. Candidate round states are `awaiting_payment`, `requested` and `delivered`. Final persistence details belong in review of the relevant slice.
- Share the allowance, deadline and eligibility rules across delivery, the client page, dashboard and payment flow. Enforce them on the server. Scope staff access to admins and the assigned editor, and scope the private link to its session.
- Follow the project's Convex handler, service and library responsibilities. Reuse existing assignment, Drive, email and Stripe boundaries where they fit. Use the existing session and add-on vocabulary in both dashboards.

## Testing decisions

Test what the client, editor and admin can observe. Prefer exercising the full workflow through the normal entry points. Existing delivery endpoint tests are prior art for the outgoing Drive link and notes, default permission denial with studio review allowed, permission changes and post-delivery status. The existing test proposal for delivery permissions and studio review notifications covers the gap around review notices and repeats. Existing customer payment E2E shows how the project verifies real Stripe flows, with checkout entry covered in CI and payment completion exercised locally.

The customer and staff workflow and Stripe confirmation are the agreed places to verify the feature. The checks below describe the intended coverage. Any new tests still require approval.

| Candidate | Behaviour and regression | Risk and gap | Proposed level |
| --- | --- | --- | --- |
| Deliver, request and fulfil one edit | Use a real client feedback link after staff delivery, submit timestamped changes, see the revision in the assigned dashboard, then deliver one round and see the renewed window. Keep another round open and a second edit independent. Catches incorrect deadlines, merged rounds, allowance sharing or misrouted feedback. | 8/10. A client can lose the chance to make changes or the wrong person can receive feedback. Current delivery tests stop at session-level delivery. | E2E through the customer and staff workflows. |
| Preserve staff delivery permission and studio review | Check that an editor without client-send permission can hand off for studio review while an approved actor delivers to the client. Studio review does not start the client window. Catches unauthorized delivery or a blocked handoff. | 7/10. Staff can expose unfinished work or fail to deliver it. Existing endpoint coverage and the studio notification proposal are the starting point. | Cover the role paths in the delivery workflow. If external notification checks need deeper coverage, seek approval to extend the existing Convex endpoint tests. |
| Confirm one paid round after Checkout | Reopen a pending Checkout from the feedback page and pay. A real confirmed payment creates one actionable round, while abandonment creates none. A duplicate webhook leaves one request and one allowance use. Catches a paid request being lost, created twice or released without payment. | 9/10. The client may pay without getting work, or staff may do unpaid work. Booking payment E2E does not cover revision rounds. | E2E through Stripe test mode and the dashboard. Seek approval for a targeted confirmation-boundary test if duplicate events cannot be checked reliably in the end-to-end flow. |

## Out of scope

- App-driven uploads to Google Drive. Editors upload exports by hand and clients can open the Drive assets folder.
- Changes to the Contractor permission toggle already delivered in PR #203 beyond applying that permission to per-edit sends.
- Implementation and test changes on this spec branch.

## Further notes

### Delivery plan

Treat each slice as a complete, reviewable feature. Start each branch from `dev` after its dependencies land.

1. **Per-edit jobs and delivery.** Add edit identities and editor dashboard rows. Deliver individual edits through the two permission paths, with studio review and client email handled separately. Enable feedback links and revision instructions when the client feedback page is available.
2. **Client free feedback intake.** Add the private feedback page, delivery windows, allowances, free submissions and editor emails. Offer paid submission once Checkout is ready.
3. **Dashboard feedback, revision delivery and completion.** Give admins and assigned editors access to round history, add revision delivery and due dates, and complete sessions after the final client windows close.
4. **Stripe payments.** Enable paid feedback with Checkout, confirmed-payment processing and the same editor work queue.

### Proposed follow-up

- A dedicated **Cancel checkout** action could let a client discard pending feedback and start again before expiry. The initial release supports resuming the existing Checkout.

### Repository references

The spec was written against `dev` at `7d3ef502c4d63b2fa63f19389b46bd2640d1b7ea`, which includes the client-send permission from PR #203.
