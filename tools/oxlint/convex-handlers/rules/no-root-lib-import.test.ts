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
			filename: "convex/nested/foo.ts",
			code: 'import { x } from "#convex/lib/foo";'
		}
	],
	invalid: [
		{
			filename: "convex/booking.ts",
			code: 'import { sessionReservationValidator } from "#convex/lib/sessions/sessionReservations";',
			errors: [
				{
					messageId: "rootLibImport",
					data: { source: "#convex/lib/sessions/sessionReservations" }
				}
			]
		},
		{
			filename: "convex/booking.ts",
			code: 'import type { BusyDayWindow } from "#convex/lib/sessions/sessionCalendarTime";',
			errors: [
				{
					messageId: "rootLibImport",
					data: { source: "#convex/lib/sessions/sessionCalendarTime" }
				}
			]
		},
		{
			filename: "convex/booking.ts",
			code: 'export { bookingAddonsValidator } from "#convex/lib/booking/bookingAddonQuantities";',
			errors: [
				{
					messageId: "rootLibImport",
					data: { source: "#convex/lib/booking/bookingAddonQuantities" }
				}
			]
		}
	]
});
