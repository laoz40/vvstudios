// These cases specify the boundary: tiny named service/lib pass-through wrappers are rejected,
// while validation, meaningful control flow, payload builders, callbacks, and other files are accepted.
import { describe, it } from "node:test";

import { RuleTester } from "oxlint/plugins-dev";

import { noTrivialResultWrapperRule } from "./no-trivial-result-wrapper.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
RuleTester.describe = describe;
RuleTester.it = it;

tester.run("convex-layers/no-trivial-result-wrapper", noTrivialResultWrapperRule, {
	valid: [
		{
			filename: "convex/shared/lib/tests/testIds.ts",
			name: "test fixture helpers are outside the production convention",
			code: `export function bookingId(value: string) { return value as Id<"bookings">; }`
		},
		{
			filename: "convex/booking/lib/lookup.ts",
			name: "an operation parameter named ok is not a Result constructor",
			code: `function run(ok) { return ok(null); }`
		},
		{
			filename: "convex/booking/lib/lookup.ts",
			name: "a plain function named ok is not a Result constructor",
			code: `import { ok } from "neverthrow"; function run(ok) { return ok(null); }`
		},

		{
			filename: "convex/sessions/services/lookup.ts",
			name: "validation that inspects its input remains a helper",
			code: `export function isPaid(booking) { return booking.status === "paid"; }`
		},
		{
			filename: "convex/sessions/lib/payload.ts",
			name: "a multi-field payload builder remains useful",
			code: `export function buildPayload(id, status) { return { id, status, source: "studio" }; }`
		},
		{
			filename: "convex/sessions/services/lookup.ts",
			name: "conditional service work remains a helper",
			code: `export function getStatus(booking) { if (booking === null) return null; return booking.status; }`
		},
		{
			filename: "convex/sessions/services/lookup.ts",
			name: "inline callbacks are not standalone declarations",
			code: `export function getStatus(result) { return result.map((status) => status); }`
		},
		{
			filename: "src/features/lookup.ts",
			name: "non Convex files are outside this rule",
			code: `export function shouldArchive(paid) { return paid; }`
		}
	],
	invalid: [
		{
			filename: "convex/booking/services/lookup.ts",
			name: "nested named helpers cannot hide static wrappers",
			code: `function run() { function updatedResult() { return {updated: true}; } return load().map(updatedResult); }`,
			errors: [{ messageId: "trivialWrapper" }]
		},

		{
			filename: "convex/booking/lib/lookup.ts",
			name: "namespace constructor aliases are checked",
			code: `import * as nt from "neverthrow"; const results = nt; function noChange() { return results["okAsync"](null); }`,
			errors: [{ messageId: "trivialWrapper" }]
		},

		{
			filename: "convex/booking/lib/lookup.ts",
			code: `import { ok as pass } from "neverthrow"; export function noChange() { return pass(null); }`,
			errors: [{ messageId: "trivialWrapper" }]
		},
		{
			filename: "convex/booking/lib/lookup.ts",
			code: `export function unchanged(value) { const result = value; return result; }`,
			errors: [{ messageId: "trivialWrapper" }]
		},
		{
			filename: "convex/booking/lib/lookup.ts",
			code: `export function emptyResult() { return {}; }`,
			errors: [{ messageId: "trivialWrapper" }]
		},

		{
			filename: "convex/sessions/services/lookup.ts",
			name: "a scalar result helper is rejected",
			code: `export function updatedResult() { return true; }`,
			errors: [{ messageId: "trivialWrapper" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "an identity helper is rejected",
			code: `export const shouldArchive = (paid) => paid;`,
			errors: [{ messageId: "trivialWrapper" }]
		},
		{
			filename: "convex/sessions/services/lookup.ts",
			name: "a tiny static object helper is rejected",
			code: `export function updatedResult() { return { updated: true }; }`,
			errors: [{ messageId: "trivialWrapper" }]
		},
		{
			filename: "convex/sessions/services/lookup.ts",
			name: "TypeScript literal assertions do not hide a static object",
			code: `export function updatedResult() { return { updated: true as const }; }`,
			errors: [{ messageId: "trivialWrapper" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "a Result constructor around a static value is rejected",
			code: `import { okAsync } from "neverthrow"; export function noChange() { return okAsync(null); }`,
			errors: [{ messageId: "trivialWrapper" }]
		},
		{
			filename: "convex/sessions/services/lookup.ts",
			name: "an exported default named helper is checked",
			code: `import { ok } from "neverthrow"; export default function unchanged(value) { return ok(value); }`,
			errors: [{ messageId: "trivialWrapper" }]
		}
	]
});
