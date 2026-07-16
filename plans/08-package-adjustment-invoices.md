# Automatic Package Adjustment Invoices

## Goal

Automatically invoice customers for Remote Podcast sessions used during a package.

- Charge **$59 per completed Remote Podcast session**.
- Send one adjustment invoice when the package finishes.
- Give the customer **7 days to pay**.
- Do not create an invoice when no Remote Podcast sessions were used.

## When a Package Finishes

Process the adjustment when either:

1. Every package session has been booked and its full duration has elapsed.
2. The package reaches its expiry date, even if some sessions were unused.

If a session is still underway when the package expires, wait until that session ends.

A session counts when it:

- Belongs to the package.
- Has a confirmed, capacity-consuming status.
- Has reached its scheduled end time.
- Includes the `Remote Podcast` add-on.

## Adjustment Calculation

```text
Remote Podcast adjustment = completed remote sessions × $59
```

Example:

```text
Remote Podcast     3 × $59.00     $177.00
Total due                          $177.00
```

The adjustment invoice must not include:

- The original package price.
- Package discounts.
- Recording space or duration charges.
- 4K or other package add-ons.

4K and Remote Podcast remain compatible.

## Automatic Processing

1. Schedule an expiry check when the package is marked as paid.
2. Re-evaluate completion whenever a package session is created, rescheduled, or unscheduled.
3. Reload the package and sessions when a scheduled check runs.
4. Ignore stale checks when the package is no longer eligible.
5. Create no more than one closeout record for each package.
6. Generate the PDF and email it automatically.
7. Record whether the email is pending, sent, or failed.

Repeated or stale jobs must never create duplicate invoices or send the same invoice twice.

## Stored Adjustment Record

Use a dedicated package adjustment record containing:

- Package ID.
- Trigger: all sessions completed or package expired.
- IDs of the Remote Podcast sessions being charged.
- Quantity, $59 rate, and total.
- Invoice number.
- Created date and seven-day due date.
- Email delivery status.
- Payment status: unpaid or paid.

When nothing is owed, store an internal zero-charge closeout so the package is not processed again. Do not generate an invoice or show an adjustment amount to the admin.

## Customer Email

The customer receives the adjustment invoice automatically. Admin approval is not required before sending.

Reuse the existing invoice PDF and email foundations with adjustment-specific copy and line items.

This sends an invoice for later payment. It does not charge a saved payment method automatically.

## Admin Dashboard

### Packages table

Show the adjustment directly beneath the package amount in the existing **Amount** column.

```text
$3,931.20                 ← paid package amount, green
$59.00                    ← adjustment amount, red
```

- While unpaid, the adjustment is red.
- After the admin marks it paid, it turns green and remains visible.
- If no adjustment is required, do not show a second value.

### Admin actions

After the invoice has been sent, admin can:

- Download the generated adjustment invoice.
- Retry a failed invoice email without creating another invoice.
- Mark the adjustment as paid.

## Tests

Cover these scenarios:

- No Remote Podcast usage.
- One or multiple Remote Podcast sessions.
- 4K and Remote Podcast used together.
- All sessions completed before package expiry.
- Package expiry with unused sessions.
- A session still underway at expiry.
- Session rescheduling and unscheduling.
- Duplicate or stale scheduled jobs.
- Failed email followed by a successful retry.
- Marking an adjustment as paid.
- Correct red and green Amount-column states.

## Migration

No migration or backward-compatibility work is required because package scheduling has no live data yet.
