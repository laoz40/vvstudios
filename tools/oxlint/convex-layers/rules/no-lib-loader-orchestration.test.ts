import { RuleTester } from "oxlint/plugins-dev";

import { noLibLoaderOrchestrationRule } from "./no-lib-loader-orchestration.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/no-lib-loader-orchestration", noLibLoaderOrchestrationRule, {
	valid: [
		{
			filename: "convex/lib/sessions/sessionLookup.ts",
			code: `export function getBookingRow(ctx, bookingId) {
  return okOrThrow(ctx.db.get("bookings", bookingId));
}`
		},
		{
			filename: "convex/lib/sessions/sessionSchedulingSave.ts",
			code: `export function applySessionPatch(ctx, bookingId, patch) {
  return okOrThrow(ctx.db.patch("bookings", bookingId, patch));
}`
		},
		{
			filename: "convex/lib/sessions/sessionLookup.ts",
			code: `function sessionFromRow(session) {
  return getBookingRow(ctx, id).andThen((row) => ok(row));
}
export function getBookingRow(ctx, bookingId) {
  return okOrThrow(ctx.db.get("bookings", bookingId));
}`
		}
	],
	invalid: [
		{
			filename: "convex/lib/sessions/sessionLookup.ts",
			code: `export function getSessionFromDb(ctx, bookingId) {
  return getBookingRow(ctx, bookingId).andThen((session) => {
    if (!session) return err({ reason: "BOOKING_NOT_FOUND" });
    return ok(session);
  });
}`,
			errors: [{ messageId: "loaderOrchestration" }]
		},
		{
			filename: "convex/lib/drive/driveStatus.ts",
			code: `export function getDriveStatus(ctx, bookingId) {
  return getDriveSetup(ctx, bookingId).andThen((setupInfo) => ok(setupInfo));
}`,
			errors: [{ messageId: "loaderOrchestration" }]
		}
	]
});
