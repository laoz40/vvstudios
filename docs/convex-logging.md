# Convex error logging

Use `logError` from `convex/shared/lib/logger.ts` for operational failures that need investigation, such as email delivery, rendering, or external API failures. It writes to `console.error`, which appears in the deployment's Convex dashboard Logs panel.

```ts
logError(
	{
		operation: "email.sendBookingReceipt",
		reason: "EMAIL_REQUEST_FAILED",
		bookingId
	},
	cause
);
```

Log once where the failure is caught, before returning the existing reason code. Name the operation directly where the API call is made and use identifiers already available there. Pass logging context only to shared utilities, such as the email sender, that need caller-specific information. Include available booking, package, invoice, or provider record IDs. Do not perform extra database reads just to populate a log.

The helper preserves an `Error`'s name, message, and stack. For HTTP rejections without a thrown exception, include the response status and useful provider error details. Select diagnostic fields explicitly; do not spread request payloads, credentials, email HTML, attachments, or signed links into logs.

Validation failures and ordinary expected outcomes stay quiet. Recovery code should preserve its existing behavior and avoid logging an already logged failure again. Uncaught exceptions are recorded by Convex automatically. Log an unexpected exception when catching it to recover.
