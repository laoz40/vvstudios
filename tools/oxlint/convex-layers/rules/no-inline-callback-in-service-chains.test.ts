/**
 * Named steps and forwarding calls
 * Service chains accept named functions and direct calls, while map and lib callbacks remain unrestricted.
 * Inline decisions and chaining
 * Conditional, logical, chained, block, and factory callbacks produce readable-chain diagnostics.
 */
import { RuleTester } from "oxlint/plugins-dev";

import { noInlineCallbackInServiceChainsRule } from "./no-inline-callback-in-service-chains.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run(
	"convex-layers/no-inline-callback-in-service-chains",
	noInlineCallbackInServiceChainsRule,
	{
		valid: [
			{
				filename: "convex/services/sessions/named-decision.ts",
				code: `function choose(record) { return record ? save(record) : ok(null); }
load().andThen(choose);`
			},
			{
				filename: "convex/services/sessions/forward-context.ts",
				code: `load().asyncAndThen(({ record }) => save({ ctx, record, id: record.id }));`
			},
			{
				filename: "convex/services/sessions/format-map.ts",
				code: `load().map((record) => record ? "active" : "inactive");`
			},
			{
				filename: "convex/sessions/lib/conditional.ts",
				code: `load().andThen((record) => record ? save(record) : ok(null));`
			},
			{
				filename: "convex/sessions/lib/lookup.ts",
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
				filename: "convex/services/sessions/conditional-argument.ts",
				code: `load().andThen((record) => save({ status: record.active ? "active" : "inactive" }));`,
				errors: [{ messageId: "inlineCallback" }]
			},
			{
				filename: "convex/services/sessions/logical-argument.ts",
				code: `load().andThen((record) => save(record || fallback));`,
				errors: [{ messageId: "inlineCallback" }]
			},
			{
				filename: "convex/services/sessions/conditional.ts",
				code: `load().andThen((record) => record ? save(record) : ok(null));`,
				errors: [{ messageId: "inlineCallback" }]
			},
			{
				filename: "convex/services/sessions/logical.ts",
				code: `load().asyncAndThen((record) => record && save(record));`,
				errors: [{ messageId: "inlineCallback" }]
			},
			{
				filename: "convex/services/sessions/chained.ts",
				code: `load().andThen((record) => save(record).map(format));`,
				errors: [{ messageId: "inlineCallback" }]
			},
			{
				filename: "convex/services/sessions/value.ts",
				code: `load().andThen((record) => record);`,
				errors: [{ messageId: "inlineCallback" }]
			},
			{
				filename: "convex/services/sessions/factory.ts",
				code: `load().andThen(makeStep(ctx));`,
				errors: [{ messageId: "inlineCallback" }]
			},
			{
				filename: "convex/services/sessions/await.ts",
				code: `load().andThen(async (record) => await save(record));`,
				errors: [{ messageId: "inlineCallback" }]
			},
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
	}
);
