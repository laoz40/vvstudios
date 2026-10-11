// Services may load data through lib functions; direct DB access stays forbidden inside generators.
import { RuleTester } from "oxlint/plugins-dev";

import { noDbInServicesRule } from "./no-db-in-services.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/no-db-in-services", noDbInServicesRule, {
	valid: [
		{
			filename: "convex/sessions/lib/lookup.ts",
			code: `export function getBookingRow(ctx) { return ctx.db.get("bookings", id); }`
		},
		{
			filename: "convex/services/sessions/sessionQueries.ts",
			code: `import { getBookingRow } from "#convex/sessions/lib/lookup";
export function loadBooking(ctx, id) { return getBookingRow(ctx, id); }`
		}
	],
	invalid: [
		{
			filename: "convex/booking/services/checkout.ts",
			code: `export function run(ctx, id) { return safeTry(async function* () { const row = yield* okOrThrow(ctx.db.get("bookings", id)); return ok(row); }); }`,
			errors: [{ messageId: "dbInService" }]
		},
		{
			filename: "convex/services/sessions/bad.ts",
			code: `export function bad(ctx) { return ctx.db.get("bookings", id); }`,
			errors: [{ messageId: "dbInService" }]
		}
	]
});
