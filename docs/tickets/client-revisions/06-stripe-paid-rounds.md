# 06: Stripe Checkout for paid rounds

**What to build:** Let a client who has used their included rounds pay for an extra round, return to an open Checkout, and see their request reach the editor after Stripe confirms payment.

**Blocked by:** 04 (Editor dashboard and revision delivery).

**Status:** ready-for-agent

See the [client revisions spec](spec.md) for the full workflow.

- [ ] The private feedback page shows **$50** for an edit eligible for another paid round and **Closed** for new requests once the deadline or allowance is exhausted. The server sets the $50 AUD price including GST and enforces up to five paid rounds per edit after the free rounds.
- [ ] Starting Checkout validates the session token, the selected edit, the active window, remaining allowance and feedback. Checkout is tied to that edit and its submitted feedback. Simultaneous attempts leave at most one open unpaid Checkout for the edit.
- [ ] **Resume payment** opens the same hosted Checkout URL, including from another tab, while Checkout is open. Closing a tab leaves it available to resume. An eligible Checkout started on time can be completed after the feedback deadline and before its 30-minute expiry.
- [ ] An expired unpaid Checkout releases the slot. A client can start another Checkout if the feedback window and allowance are still open. An unpaid Checkout uses no allowance, sends no request email and creates no actionable work.
- [ ] Only Stripe confirmation through the webhook creates the actionable round, advances the paid count, sets **Revision requested**, starts the editor's two-business-day turnaround and sends the request email. Repeated events apply the payment once. Staff status and send actions cannot unlock unpaid work.
- [ ] A valid open Checkout keeps the session in review when it would otherwise complete. Recheck on expiry or payment confirmation, using current windows and outstanding rounds. A confirmed round joins the same one-round-per-export delivery flow as a free round.
- [ ] Verify that a client can resume and pay in Stripe test mode and that the editor receives one actionable request. Check the outcomes for an expired Checkout and a repeated payment confirmation. Enable paid feedback after the editor and admin fulfilment paths are ready.
