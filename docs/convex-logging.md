# Convex error logging

Use `logError` from `convex/shared/lib/logger.ts` for operational failures that need investigation, such as email delivery, rendering, or external API failures. It writes to `console.error`. Backend calls appear in the deployment's Convex dashboard Logs panel; calls in browser code appear in the browser console and are not forwarded to Convex.

```ts
const failure = { reason: "EMAIL_REQUEST_FAILED" } as const;

logError(
	{
		operation: "email.sendBookingReceipt",
		...failure,
		bookingId
	},
	cause
);

return failure;
```

Log once where the failure is caught, before returning the existing reason code. Name the operation directly where the API call is made and use identifiers already available there. Pass logging context only to shared utilities, such as the email sender, that need caller-specific information. Include available booking, package, invoice, or provider record IDs. Do not perform extra database reads just to populate a log.

The helper preserves an `Error`'s name, message, and stack. For HTTP rejections without a thrown exception, include the response status and useful provider error details. Select diagnostic fields explicitly; do not spread request payloads, credentials, email HTML, attachments, or signed links into logs.

Choose logging based on where the failure occurs, not just its reason code:

- Rejected customer input, expired links, and ordinary authorization failures stay quiet.
- Invalid stored booking/payment data and invalid external provider responses need logs. These are operational failures even if the reason contains `INVALID`.
- Failures completing a booking or sending its receipt after checkout payment need logs, including unavailable slots and invalid stored booking details.
- Expected missing resources during idempotent cleanup stay quiet. A missing stored Stripe customer, product, or invoice that prevents billing needs a log.
- Webhook events for invoices this app does not manage stay quiet. An invoice marked as belonging to this app with no matching local record needs a log.

Recovery code should preserve its existing behavior and avoid logging an already logged failure again. Uncaught exceptions are recorded by Convex automatically. Log an unexpected exception when catching it to recover.
