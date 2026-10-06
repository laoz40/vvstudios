import { RuleTester } from "oxlint/plugins-dev";

import { noInlineCallbackInServiceChainsRule } from "./no-inline-callback-in-service-chains.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/no-inline-callback-in-service-chains", noInlineCallbackInServiceChainsRule, {
	valid: [
		{
			filename: "convex/lib/sessions/sessionLookup.ts",
			code: `export function load(ctx) { return getBookingRow(ctx, id).andThen((session) => session); }`
		},
		{
			filename: "convex/services/sessions/good.ts",
			code: `export function load(ctx, id) {
  return getBookingRow(ctx, id).andThen(validateSession).andThen((session) => patchSession(ctx, session));
}`
		},
		{
			filename: "convex/services/sessions/pass-through.ts",
			code: `function expireCheckoutAfterValidate(ctx, decision) { return ok(decision); }
export function expire(ctx) {
  return load(ctx).andThen(validateSession).andThen((decision) => expireCheckoutAfterValidate(ctx, decision));
}`
		},
		{
			filename: "convex/services/sessions/inline-map.ts",
			code: `export function load(ctx, id) {
  return getBookingRow(ctx, id).map((session) => session._id);
}`
		}
	],
	invalid: [
		{
			filename: "convex/services/sessions/bad-and-then.ts",
			code: `export function bad(ctx) {
  return getBookingRow(ctx, id).andThen((session) => { return patchSession(ctx, session); });
}`,
			errors: [{ messageId: "inlineCallback" }]
		},
		{
			filename: "convex/services/sessions/bad-async.ts",
			code: `export function bad(ctx) {
  return loadRow(ctx).asyncAndThen(async (row) => { return sendEmail(row); });
}`,
			errors: [{ messageId: "inlineCallback" }]
		},
		{
			filename: "convex/services/sessions/bad-curried.ts",
			code: `function patchSession(ctx) {
  return (session) => patchRow(ctx, session);
}
export function bad(ctx) {
  return getBookingRow(ctx, id).andThen(patchSession(ctx));
}`,
			errors: [{ messageId: "curriedFactory" }]
		}
	]
});
