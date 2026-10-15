// These cases keep logged failures tied to the returned failure object while allowing recovery,
// unrelated early returns, nested functions, and shadowed logger names.
import { describe, it } from "node:test";

import { RuleTester } from "oxlint/plugins-dev";

import { loggedFailureSharesReasonRule } from "./logged-failure-shares-reason.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
RuleTester.describe = describe;
RuleTester.it = it;

tester.run("convex-layers/logged-failure-shares-reason", loggedFailureSharesReasonRule, {
	valid: [
		{
			filename: "convex/drive/lib/setup.ts",
			name: "a shared failure object can be logged and returned",
			code: `import { err } from "neverthrow"; import { logError as recordFailure } from "#convex/shared/lib/logger"; function fail(cause) { const failure = { reason: "DRIVE_SETUP_FAILED", code: 1 }; recordFailure({ operation: "drive.setup", ...failure }, cause); return err(failure); }`
		},
		{
			filename: "convex/drive/lib/setup.ts",
			name: "the returned failure reason can be logged directly",
			code: `import { logError } from "#convex/shared/lib/logger"; function fail(failure, cause) { logError({ operation: "drive.setup", reason: failure.reason }, cause); return failure; }`
		},
		{
			filename: "convex/drive/lib/setup.ts",
			name: "an earlier expected return is unrelated to the logged failure",
			code: `import { err } from "neverthrow"; import * as logger from "#convex/shared/lib/logger"; function fail(cause) { if (!cause) return { reason: "DRIVE_NOT_REQUIRED" }; const failure = { reason: cause.message }; logger.logError({ operation: "drive.setup", reason: failure.reason }, cause); return err(failure); }`
		},
		{
			filename: "convex/drive/lib/setup.ts",
			name: "success recovery without a returned failure is ignored",
			code: `import { ok } from "neverthrow"; import { logError } from "#convex/shared/lib/logger"; function recover(cause) { logError({ operation: "drive.recover", reason: "RECOVERED" }, cause); return ok(null); }`
		},
		{
			filename: "convex/drive/lib/setup.ts",
			name: "nested failures are checked in their own function",
			code: `import { err } from "neverthrow"; import { logError } from "#convex/shared/lib/logger"; function outer() { function inner(cause) { const failure = { reason: cause.message }; logError({ reason: failure.reason }, cause); return err(failure); } return null; }`
		},
		{
			filename: "src/sites/studio/email.ts",
			name: "the rule also applies to source files",
			code: `import { logError } from "#convex/shared/lib/logger"; function recover(cause) { logError({ reason: "EMAIL_FAILED" }, cause); return null; }`
		},
		{
			filename: "convex/drive/lib/setup.ts",
			name: "a shadowed logger is unrelated",
			code: `import { err } from "neverthrow"; import { logError } from "#convex/shared/lib/logger"; function fail(logError, cause) { const failure = { reason: "DRIVE_FAILED" }; logError({ reason: "DRIVE_FAILED" }, cause); return err(failure); }`
		},
		{
			filename: "src/sites/studio/email.ts",
			name: "a later spread supplies the final reason",
			code: `import { err } from "neverthrow"; import { logError } from "#convex/shared/lib/logger"; function fail(cause) { const failure = { reason: "EMAIL_FAILED" }; logError({ reason: "OVERRIDDEN", ...failure }, cause); return err(failure); }`
		}
	],
	invalid: [
		{
			filename: "convex/stripe/lib/invoice.ts",
			name: "logging and directly returning separate objects duplicates the reason",
			code: `import { logError } from "#convex/shared/lib/logger"; function fail(cause) { logError({ reason: "STRIPE_INVOICE_LOOKUP_FAILED" }, cause); return { reason: "STRIPE_INVOICE_LOOKUP_FAILED" as const }; }`,
			errors: [{ messageId: "failureReason" }]
		},
		{
			filename: "convex/stripe/lib/invoice.ts",
			name: "a classified failure must supply the logged reason",
			code: `import { logError } from "#convex/shared/lib/logger"; function fail(cause) { const failure = classify(cause); logError({ reason: "OTHER_FAILURE" }, cause); return failure; }`,
			errors: [{ messageId: "failureReason" }]
		},
		{
			filename: "convex/drive/lib/setup.ts",
			name: "matching literals still duplicate the failure reason",
			code: `import { err } from "neverthrow"; import { logError } from "#convex/shared/lib/logger"; function fail(cause) { const failure = { reason: "DRIVE_FAILED" }; logError({ reason: "DRIVE_FAILED" }, cause); return err(failure); }`,
			errors: [{ messageId: "failureReason" }]
		},
		{
			filename: "convex/drive/lib/setup.ts",
			name: "mismatched literals do not stay in sync",
			code: `import { err } from "neverthrow"; import { logError } from "#convex/shared/lib/logger"; function fail(cause) { const failure = { reason: "DRIVE_FAILED" }; logError({ reason: "LOGGING_FAILED" }, cause); return err(failure); }`,
			errors: [{ messageId: "failureReason" }]
		},
		{
			filename: "convex/drive/lib/setup.ts",
			name: "a later explicit reason overrides a failure spread",
			code: `import { err } from "neverthrow"; import { logError } from "#convex/shared/lib/logger"; function fail(cause) { const failure = { reason: "DRIVE_FAILED" }; logError({ ...failure, reason: "OTHER_FAILURE" }, cause); return err(failure); }`,
			errors: [{ messageId: "failureReason" }]
		}
	]
});
