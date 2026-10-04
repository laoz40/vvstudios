/**
 * Root `convex/*.ts` files that still import `#convex/lib/**` during migration.
 * Remove a path when the handler delegates to `convex/services/**` instead.
 * See `README.md`.
 */
export const ROOT_HANDLER_LIB_IMPORT_ALLOWLIST = new Set([
	"convex/bookingConfirmation.ts",
	"convex/customInvoices.ts",
	"convex/devSeed.ts",
	"convex/googleCalendar.ts",
	"convex/http.ts",
	"convex/packageAdjustments.ts",
	"convex/packagePayment.ts",
	"convex/packageScheduling.ts",
	"convex/packageSchedulingCalendar.ts",
	"convex/packages.ts",
	"convex/schema.ts",
	"convex/sessionCheckout.ts",
	"convex/sessionReminders.ts",
	"convex/sessionScheduling.ts",
	"convex/sessions.ts",
	"convex/stripe.ts"
]);
