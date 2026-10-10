import { RuleTester } from "oxlint/plugins-dev";

import { noDbInServicesRule } from "./no-db-in-services.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/no-db-in-services", noDbInServicesRule, {
	valid: [
		{
			filename: "convex/sessions/lib/sessionLookup.ts",
			code: `export function getBookingRow(ctx) { return ctx.db.get("bookings", id); }`
		},
		{
			filename: "convex/services/sessions/sessionQueries.ts",
			code: `import { getBookingRow } from "#convex/sessions/lib/sessionLookup";
export function loadBooking(ctx, id) { return getBookingRow(ctx, id); }`
		}
	],
	invalid: [
		{
			filename: "convex/services/sessions/bad.ts",
			code: `export function bad(ctx) { return ctx.db.get("bookings", id); }`,
			errors: [{ messageId: "dbInService" }]
		}
	]
});
