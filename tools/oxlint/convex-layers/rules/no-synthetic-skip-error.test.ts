// These cases specify that explicit SKIP/SKIPPED error sentinels are rejected, while real domain
// errors, ordinary successful exits, computed reasons, and unrelated source files remain valid.
import { describe, it } from "node:test";

import { RuleTester } from "oxlint/plugins-dev";

import { noSyntheticSkipErrorRule } from "./no-synthetic-skip-error.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
RuleTester.describe = describe;
RuleTester.it = it;

tester.run("convex-layers/no-synthetic-skip-error", noSyntheticSkipErrorRule, {
	valid: [
		{
			filename: "convex/booking/lib/lookup.ts",
			name: "sibling function constants do not override domain reasons",
			code: `import { err } from "neverthrow"; function first() { const reason = "BOOKING_NOT_FOUND"; return err({reason}); } function other() { const reason = "SKIP"; return reason; }`
		},
		{
			filename: "convex/booking/lib/lookup.ts",
			name: "a shadowed constructor is not neverthrow",
			code: `import { err } from "neverthrow"; function other(err) { return err({reason: "SKIP"}); }`
		},

		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "a real domain error remains an error",
			code: `import { err } from "neverthrow"; export function missing() { return err({ reason: "BOOKING_NOT_FOUND" }); }`
		},
		{
			filename: "convex/sessions/services/lookup.ts",
			name: "successful recovery remains a success",
			code: `import { okAsync } from "neverthrow"; export function skip() { return okAsync(null); }`
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "a computed error reason is not guessed",
			code: `import { err } from "neverthrow"; export function fail(reason) { return err({ reason }); }`
		},
		{
			filename: "src/features/lookup.ts",
			name: "non Convex files are outside this rule",
			code: `import { err } from "neverthrow"; export function skip() { return err({ reason: "SKIP" }); }`
		}
	],
	invalid: [
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "a direct skip sentinel is rejected",
			code: `import { err } from "neverthrow"; export function skip() { return err("SKIP"); }`,
			errors: [{ messageId: "syntheticSkipError" }]
		},
		{
			filename: "convex/sessions/services/lookup.ts",
			name: "renamed error imports are recognized",
			code: `import { errAsync as failAsync } from "neverthrow"; export function skip() { return failAsync({ reason: "SKIPPED_ALREADY" }); }`,
			errors: [{ messageId: "syntheticSkipError" }]
		},
		{
			filename: "convex/sessions/services/lookup.ts",
			name: "namespace error constructors are recognized",
			code: `import * as neverthrow from "neverthrow"; export function skip() { return neverthrow.err({ kind: "ALREADY_SKIPPED" }); }`,
			errors: [{ messageId: "syntheticSkipError" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "simple const aliases and computed namespace constructors are followed",
			code: `import * as neverthrow from "neverthrow"; const reject = neverthrow["err"]; const reason = "SKIP" as const; const payload = { reason }; export function skip() { return reject(payload); }`,
			errors: [{ messageId: "syntheticSkipError" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "skip reason prefixes are recognized",
			code: `import { err } from "neverthrow"; export function skip() { return err({ reason: "SKIP_EMAIL" }); }`,
			errors: [{ messageId: "syntheticSkipError" }]
		}
	]
});
