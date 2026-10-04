import { RuleTester } from "oxlint/plugins-dev";

import { noRootLibImportRule } from "./no-root-lib-import.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-handlers/no-root-lib-import", noRootLibImportRule, {
	valid: [
		{
			filename: "convex/lib/booking/foo.ts",
			code: 'import { x } from "#convex/lib/booking/bookingAddonQuantities";'
		},
		{
			filename: "convex/services/booking/foo.ts",
			code: 'import { x } from "#convex/lib/booking/bookingAddonQuantities";'
		},
		{
			filename: "convex/internal/drive/foo.ts",
			code: 'import { x } from "#convex/lib/drive/driveFolders";'
		},
		{
			filename: "convex/sessions.ts",
			code: 'import { sessionsDrive } from "#convex/services/drive/sessionsDrive";'
		},
		{
			filename: "src/app.ts",
			code: 'import { okOrThrow } from "#/lib/result";'
		},
		{
			filename: "convex/http.ts",
			code: 'import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/lib/packages/packageAdjustmentInvoicePayment";'
		},
		{
			filename: "convex/googleCalendar.ts",
			code: 'import { type BusyDayWindow } from "#convex/lib/sessions/sessionCalendarTime";'
		},
		{
			filename: "convex/booking.ts",
			code: 'import { sessionReservationValidator } from "#convex/lib/sessions/sessionReservations";'
		},
		{
			filename: "convex/booking.ts",
			code: `import {
  bookingAddonsValidator,
  bookingAddonQuantitiesValidator
} from "#convex/lib/booking/bookingAddonQuantities";`
		},
		{
			filename: "convex/schema.ts",
			code: 'export { bookingAddonsValidator } from "#convex/lib/booking/bookingAddonQuantities";'
		},
		{
			filename: "convex/nested/foo.ts",
			code: 'import { x } from "#convex/lib/foo";'
		}
	],
	invalid: [
		{
			filename: "convex/booking.ts",
			code: 'import { reserveSessionTime } from "#convex/lib/sessions/sessionReservations";',
			errors: [
				{
					messageId: "rootLibImport",
					data: { source: "#convex/lib/sessions/sessionReservations" }
				}
			]
		},
		{
			filename: "convex/booking.ts",
			code: `import {
  sessionReservationValidator,
  reserveSessionTime
} from "#convex/lib/sessions/sessionReservations";`,
			errors: [
				{
					messageId: "rootLibImport",
					data: { source: "#convex/lib/sessions/sessionReservations" }
				}
			]
		},
		{
			filename: "convex/booking.ts",
			code: 'import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";',
			errors: [
				{
					messageId: "rootLibImport",
					data: { source: "#convex/lib/rateLimits" }
				}
			]
		},
		{
			filename: "convex/booking.ts",
			code: 'import { PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS } from "#convex/lib/packages/packageAdjustments";',
			errors: [
				{
					messageId: "rootLibImport",
					data: { source: "#convex/lib/packages/packageAdjustments" }
				}
			]
		},
		{
			filename: "convex/booking.ts",
			code: 'export * from "#convex/lib/booking/bookingAddonQuantities";',
			errors: [
				{
					messageId: "rootLibImport",
					data: { source: "#convex/lib/booking/bookingAddonQuantities" }
				}
			]
		}
	]
});
