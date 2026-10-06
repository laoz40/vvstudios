import { RuleTester } from "oxlint/plugins-dev";

import { noExportOkOrThrowOnCallRule } from "./no-export-okorthrow-on-call.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("neverthrow/no-export-okorthrow-on-call", noExportOkOrThrowOnCallRule, {
	valid: [
		`okOrThrow(ctx.db.get("bookings", bookingId));`,
		`okOrThrow(ctx.db.patch("bookings", bookingId, merged).then(() => null));`,
		`okOrThrow(ctx.runQuery(internal.sessions.getSessionById, { bookingId }));`,
		`okOrThrow(ctx.runMutation(internal.foo.bar, args));`,
		`okOrThrow(ctx.scheduler.runAfter(0, internal.jobs.tick, {}));`,
		`okOrThrow(ctx.auth.getUserIdentity());`,
		`okOrThrow(
      ctx.db
        .query("bookingRescheduleLinks")
        .withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
        .unique()
    );`,
		`okOrThrow(crypto.subtle.digest("SHA-256", encoded).then((buffer) => buffer));`,
		`okOrThrow(
      Promise.all(
        links.map((link) => ctx.db.patch("bookingRescheduleLinks", link._id, { status: "used" }))
      )
    );`
	],
	invalid: [
		{
			code: `okOrThrow(fetchListAdminPackages(ctx, args));`,
			errors: [{ messageId: "notConvexIo" }]
		},
		{
			code: `okOrThrow(rateLimiter.limit(ctx, "bookingSubmitGlobal"));`,
			errors: [{ messageId: "notConvexIo" }]
		},
		{
			code: `okOrThrow(resolveMx(domain));`,
			errors: [{ messageId: "notConvexIo" }]
		}
	]
});
