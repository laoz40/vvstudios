# 03: Private feedback page and free rounds

**What to build:** Give clients a private link where they can see each purchased edit and submit an included round of timestamped feedback. Send the request to the assigned editor.

**Blocked by:** 01 (Editor dashboard and initial delivery).

**Status:** ready-for-agent

See the [client revisions spec](spec.md) for the full workflow.

- [ ] For revision-eligible edits, the delivery email includes the private revision link, timestamp format, revision rules, free revision allowance, and the $50 AUD including GST price and five-extra-revision cap. Apply the same revision information to the admin delivery path when ticket 02 lands. Legacy deliveries have no revision link or revision window, and the server rejects revision requests for legacy edits.
- [ ] The private link requires no login and only grants access to the associated session's purchased edits and Drive assets folder link. Render each purchased edit as its own card (ordered by add-on and item number, identifying repeated units as Video or Pack). Each edit keeps its own window and allowance, including across package sessions.
- [ ] An unsent edit shows **Editing in progress** (including when it is with the studio for review) along with its free revision allowance and ~6-day initial editing turnaround expectation. Delivered edits show **Request changes by [date]** while open. The window ends at 11:59 pm Sydney time on the second business day after the latest successful client delivery. Count Monday through Friday and ignore public holidays.
- [ ] Show the applicable **Free** or **Closed** state for free intake (using customer-facing **Free revisions** / **Extra revisions** wording rather than "rounds"). The $50 action and paid eligibility display become available with ticket 06. Explain revision allowances, the 2-business-day revision window, and the ~6-day initial editing time in the page overview. Show the corrections-only note (`Limited to corrections to cuts, timing, and text errors.`) only inside the form for Rough Cut and Clip Volume Pack; do not display "Stylised changes allowed" on Complete Edit or Handcrafted Clips.
- [ ] The client submits one revision request for one edit. Each row has a timestamp (`MM:SS`, `H:MM:SS`, or range) and note, with a clip number for clip add-ons. **+ Add another** adds a row, and a Clip Volume Pack's changes stay in the same request. Prior submitted revisions display collapsed by default with their estimated ready date (2 business days).
- [ ] The server validates the private token, purchased edit, delivery, window, allowance and row fields. Every accepted free submission consumes one free revision and becomes actionable. The client can submit again with an earlier revision open if the window and allowance permit it.
- [ ] A successful request sets the edit to **Revision requested** and emails the assigned editor (falling back to the studio address if no active editor is assigned) with the client, session, edit, revision number, timestamped rows and dashboard link. The studio's review notification remains separate.
- [ ] Verify free intake using a real delivery link in a test environment. Ensure initial-delivery dashboard controls cannot clobber edits in **Revision requested**. Enable full fulfilment through tickets 04 and 05.
