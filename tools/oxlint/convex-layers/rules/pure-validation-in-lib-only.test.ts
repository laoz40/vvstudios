import { RuleTester } from "oxlint/plugins-dev";

import { pureValidationInLibOnlyRule } from "./pure-validation-in-lib-only.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/pure-validation-in-lib-only", pureValidationInLibOnlyRule, {
	valid: [
		{
			filename: "convex/services/packages/good-import.ts",
			code: `import { validatePackageExpiry } from "#convex/lib/packages/packageCheckout";
export function expire(ctx, id) {
  return getPackage(ctx, id).andThen(validatePackageExpiry);
}`
		},
		{
			filename: "convex/services/packages/orchestration.ts",
			code: `function saveNotes(ctx, args) {
  return (session) => patchNotes(ctx, session, args.notes);
}
export function run(ctx, args) {
  return load(ctx).andThen(saveNotes(ctx, args));
}`
		},
		{
			filename: "convex/services/packages/good-pass-through.ts",
			code: `import { validatePackageExpiry } from "#convex/lib/packages/packageCheckout";
export function expire(ctx, id) {
  return getPackage(ctx, id).andThen((row) => validatePackageExpiry(row));
}`
		}
	],
	invalid: [
		{
			filename: "convex/services/packages/bad-local-validate.ts",
			code: `function rejectMissing(session) {
  if (session === null) return err({ reason: "NOT_FOUND" });
  return ok(session);
}
export function load(ctx, id) {
  return getRow(ctx, id).andThen(rejectMissing);
}`,
			errors: [{ messageId: "pureValidationInService" }]
		},
		{
			filename: "convex/services/packages/bad-curried-validate.ts",
			code: `function rejectExpired(now) {
  return (session) => {
    if (session.expiresAt < now) return err({ reason: "EXPIRED" });
    return ok(session);
  };
}
export function load(ctx, id, now) {
  return getRow(ctx, id).andThen(rejectExpired(now));
}`,
			errors: [{ messageId: "pureValidationInService" }]
		},
		{
			filename: "convex/services/packages/bad-pass-through-validate.ts",
			code: `function rejectMissing(session) {
  if (session === null) return err({ reason: "NOT_FOUND" });
  return ok(session);
}
export function load(ctx, id) {
  return getRow(ctx, id).andThen((row) => rejectMissing(row));
}`,
			errors: [{ messageId: "pureValidationInService" }]
		},
		{
			filename: "convex/services/packages/bad-multi-arg-validate.ts",
			code: `function rejectStripeMismatch(stripeSessionId, packageFromDb) {
  if (packageFromDb.stripeSessionId !== stripeSessionId) return err({ reason: "MISMATCH" });
  return ok(packageFromDb);
}
export function load(ctx, args) {
  return getPackage(ctx, args.id).andThen((row) => rejectStripeMismatch(args.stripeSessionId, row));
}`,
			errors: [{ messageId: "pureValidationInService" }]
		}
	]
});
