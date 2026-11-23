# 03: Private feedback page and free rounds

**What to build:** Give clients a private link where they can see each purchased edit and submit an included round of timestamped feedback. Send the request to the assigned editor.

**Blocked by:** 01 (Editor dashboard and initial delivery).

**Status:** ready-for-agent

See the [client revisions spec](spec.md) for the full workflow.

- [ ] For revision-eligible edits, the delivery email includes the private feedback link, timestamp format, revision rules, free allowance, and the $50 AUD including GST price and five-paid-round cap. Apply the same feedback information to the admin delivery path when ticket 02 lands. Legacy deliveries have no feedback link or revision window, and the server rejects feedback requests for legacy edits.
- [ ] The private link requires no login and only grants access to the associated session's purchased edits and Drive assets folder link. Group edits by add-on and identify repeated units by episode. Each edit keeps its own window and allowance, including across package sessions.
- [ ] An unsent edit shows **Not delivered yet**, including when it is with the studio for review. Delivered edits show **Request changes by [date]** while open. The window ends at 11:59 pm Sydney time on the second business day after the latest successful client delivery. Count Monday through Friday and ignore public holidays.
- [ ] Show the applicable **Free** or **Closed** state for free intake. The $50 action and paid eligibility display become available with ticket 06. Explain the round allowances and included changes in the page copy. Rough Cut and Clip Volume Pack include one free corrections round. Complete Edit and Handcrafted Clips include two free rounds and allow stylised changes.
- [ ] The client submits one round for one edit. Each feedback row has a timestamp and note, with a clip number for clip add-ons. **Add another** adds a row, and a Clip Volume Pack's feedback stays in the same round.
- [ ] The server validates the private token, purchased edit, delivery, window, allowance and feedback fields. Every accepted free submission consumes one free round and becomes actionable. The client can submit again with an earlier round open if the window and allowance permit it.
- [ ] A successful request sets the edit to **Revision requested** and emails the assigned editor with the client, session, edit, feedback rows and dashboard link. The studio's review notification remains separate.
- [ ] Verify free intake using a real delivery link in a test environment. Enable the client feedback links for production when editors and admins can fulfil requests through tickets 04 and 05.
