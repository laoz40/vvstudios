// Plain reads, writes, maps, service composition, and a locally defined safeTry are valid; the
// neverthrow safeTry import, namespace access, and unbound safeTry calls are rejected in lib files.
import { describe, it } from "node:test";

import { RuleTester } from "oxlint/plugins-dev";

import { noLibResultCompositionRule } from "./no-lib-result-composition.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
RuleTester.describe = describe;
RuleTester.it = it;

tester.run("convex-layers/no-lib-result-composition", noLibResultCompositionRule, {
	valid: [
		{
			filename: "convex/sessions/lib/lookup.ts",
			code: `export function getBookingRow(ctx, bookingId) {
  return okOrThrow(ctx.db.get("bookings", bookingId));
}`
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			code: `export function getSessionStatus(ctx, bookingId) {
  return okOrThrow(ctx.db.get("bookings", bookingId)).map((row) => row?.status);
}`
		},
		{
			filename: "convex/sessions/lib/schedulingSave.ts",
			code: `export function applySessionPatch(ctx, bookingId, patch) {
  return okOrThrow(ctx.db.patch("bookings", bookingId, patch)).map((row) => row);
}`
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			code: `export function validateSession(session) {
  return ok(session).map((value) => value ?? null);
}`
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			code: `export function mapResult(result) {
  return result.then((value) => value).map((value) => value);
}`
		},
		{
			filename: "convex/sessions/services/lookup.ts",
			code: `import { safeTry } from "neverthrow";
export function validateSession(session) {
  return ok(session).andThen((value) => safeTry(function* () { return value; }));
}`
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "an unrelated local safeTry helper is allowed",
			code: `function safeTry(value) { return ok(value); }
export function validate(value) { return safeTry(value); }`
		}
	],
	invalid: [
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "andThen is banned in pure helpers too",
			code: `export function validateSession(session) {
  return ok(session).andThen((value) => ok(value));
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "asyncAndThen is banned in pure helpers too",
			code: `export function validateSession(session) {
  return ok(session).asyncAndThen(async (value) => ok(value));
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "storing a banned method reference is invalid",
			code: `export function getMethod(result) {
  const method = result.andThen;
  return method;
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "computed banned method access is invalid",
			code: `export function validateSession(result) {
  return result["andThen"]((value) => ok(value));
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "optional banned method access is invalid",
			code: `export function validateSession(result) {
  return result?.andThen((value) => ok(value));
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "private functions are checked",
			code: `function validateSession(session) {
  return ok(session).andThen((value) => ok(value));
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "default exported functions are checked",
			code: `export default function validateSession(session) {
  return ok(session).asyncAndThen(async (value) => ok(value));
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "functions exported through aliases are checked",
			code: `function implementation(session) {
  return ok(session).andThen((value) => ok(value));
}
export { implementation as validateSession };`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "banned methods inside try blocks are checked",
			code: `export function validateSession(session) {
  try {
    return ok(session).andThen((value) => ok(value));
  } catch (error) {
    return err(error);
  }
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "banned methods inside loops are checked",
			code: `export function validateSessions(sessions) {
  for (const session of sessions) {
    ok(session).andThen((value) => ok(value));
  }
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "banned methods inside switch branches are checked",
			code: `export function validateSession(session, mode) {
  switch (mode) {
    case "validate": return ok(session).andThen((value) => ok(value));
    default: return ok(session);
  }
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "destructuring a banned method is invalid",
			code: `export function getMethod(result) {
  const { andThen } = result;
  return andThen;
}`,
			errors: [{ messageId: "resultComposition" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "safeTry imports are reported once even when called",
			code: `import { safeTry } from "neverthrow";
export function run(value) { return safeTry(value); }`,
			errors: [{ messageId: "safeTry" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "renamed safeTry imports are banned at the import",
			code: `import { safeTry as tryResult } from "neverthrow";
export function run(value) { return tryResult(value); }`,
			errors: [{ messageId: "safeTry" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "namespace safeTry access is banned",
			code: `import * as neverthrow from "neverthrow";
export function run(value) { return neverthrow.safeTry(value); }`,
			errors: [{ messageId: "safeTry" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "destructured namespace safeTry is banned once",
			code: `import * as neverthrow from "neverthrow";
export function run(value) {
  const { safeTry } = neverthrow;
  return safeTry(value);
}`,
			errors: [{ messageId: "safeTry" }]
		},
		{
			filename: "convex/sessions/lib/lookup.ts",
			name: "global safeTry calls are banned",
			code: `export function run(value) { return safeTry(value); }`,
			errors: [{ messageId: "safeTry" }]
		}
	]
});
