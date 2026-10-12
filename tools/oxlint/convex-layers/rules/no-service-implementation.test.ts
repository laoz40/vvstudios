// Services allow value mappings, Result chains, delegated yields, and for...of in neverthrow safeTry.
// Tests reject loops outside safeTry, for await, unrelated generators, raw awaits, branching, I/O, and operation dispatch.
import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";
import { noServiceImplementationRule } from "./no-service-implementation.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
RuleTester.describe = describe;
RuleTester.it = it;
const filename = "convex/booking/services/checkout.ts";

tester.run("convex-layers/no-service-implementation", noServiceImplementationRule, {
	valid: [
		{
			filename,
			name: "sequential Result operations use a for...of loop in safeTry",
			code: `import { ok, safeTry } from "neverthrow"; export function run(ctx, rows) { return safeTry(async function* () { for (const row of rows) { yield* save(ctx, row); } return ok(null); }); }`
		},
		{
			filename,
			name: "aliased safeTry supports sequential iteration",
			code: `import { ok, safeTry as tryResult } from "neverthrow"; export function run(rows) { return tryResult(function* () { for (const row of rows) { yield* validate(row); } return ok(rows); }); }`
		},
		{
			filename,
			name: "namespace safeTry supports sequential iteration",
			code: `import * as results from "neverthrow"; export function run(rows) { return results.safeTry(function* () { for (const row of rows) { yield* validate(row); } return results.ok(rows); }); }`
		},
		{
			filename,
			code: `import { ok, safeTry } from "neverthrow"; export function run(ctx) { return safeTry(async function* () { const row = yield* load(ctx); yield* save(ctx, row); return ok(row); }); }`
		},
		{
			filename,
			code: `import { ok, safeTry as tryResult } from "neverthrow"; export function run(row) { return tryResult(function* () { const value = yield* validate(row); return ok(value); }); }`
		},
		{
			filename,
			code: `import * as results from "neverthrow"; export function run(ctx) { return results.safeTry(async function* () { const row = yield* load(ctx); return results.ok(row); }); }`
		},
		{
			filename,
			code: `export function run(row) { return save({ status: row.paid ? "paid" : "unpaid", name: row.name ?? "Guest" }).map(value => ({ customer: value.customer?.name })); }`
		},
		{
			filename,
			code: `export function run(rows) { return selectBookingsNeedingReceipts(rows).andThen(eligible => ResultAsync.combine(eligible.map(row => sendReceipt(row)))); }`
		},
		{
			filename,
			code: `export function run(row) { return load(row).map(value => value.active && value.paid); }`
		},
		{
			filename,
			code: `export function run(row) { const label = row.paid ? "Paid" : "Unpaid"; return save({ label }); }`
		},
		{
			filename,
			code: `export function run(row) { return load(row).andThen(save).orElse(recover); }`
		},

		{
			filename,
			code: `export function confirm(ctx, id) { return loadBooking(ctx, id).andThen(validateBookingForConfirmation).andThen(booking => saveBookingConfirmation(ctx, booking)).andThen(booking => sendBookingReceipt(booking)).map(() => ({ confirmed: true })); }`
		},
		{
			filename,
			code: `export function run(ctx, row) { return save(ctx, { id: row.id, label: row.name ?? "Guest", status: row.paid ? "paid" : "unpaid", next: row.count + 1 }).map(() => null); }`
		},
		{
			filename,
			code: `import { ok, okAsync } from "neverthrow"; export function run(ctx) { return load(ctx).andThen(row => save(ctx, row).map(() => ({ row }))).andThen(value => ok(value)).orElse(() => okAsync(null)); }`
		},
		{
			filename,
			code: `export function parallel(ctx) { return ResultAsync.combine([first(ctx), second(ctx)]).map(([a, b]) => ({ a, b })); }`
		},
		{
			filename,
			code: `export function sequential(rows) { return rows.reduce((previous, row) => previous.andThen(() => save(row)), okAsync(null)); }`
		},
		{
			filename,
			code: `export function run(action) { const labels = { save: "Saved", send: "Sent" }; return save(action).map(() => ({ label: labels[action] })); }`
		},
		{
			filename,
			code: `"use node"; export type Args = { enabled: boolean }; export function run(args: Args) { return step(args); }`
		},
		{
			filename: "convex/booking/lib/checkout.ts",
			code: `export function step(row) { if (!row) return ok(null); return ok({ id: row.id }); }`
		}
	],
	invalid: [
		{
			filename,
			name: "sequential loops do not assign into an existing variable",
			code: `import { ok, safeTry } from "neverthrow"; export function run(rows, row) { return safeTry(async function* () { for (row of rows) { yield* save(row); } return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "loop bindings stay immutable",
			code: `import { ok, safeTry } from "neverthrow"; export function run(rows) { return safeTry(async function* () { for (let row of rows) { yield* save(row); } return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "for await consumes raw async iterables instead of Result steps",
			code: `import { ok, safeTry } from "neverthrow"; export function run(rows) { return safeTry(async function* () { for await (const row of rows) { yield* save(row); } return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "unrelated safeTry imports do not permit loops",
			code: `import { safeTry } from "./helpers"; export function run(rows) { return safeTry(function* () { for (const row of rows) { save(row); } }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "shadowed safeTry imports do not permit loops",
			code: `import { safeTry } from "neverthrow"; export function run(rows, safeTry) { return safeTry(function* () { for (const row of rows) { save(row); } }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "nested unrelated functions do not inherit the loop exception",
			code: `import { ok, safeTry } from "neverthrow"; export function run(rows) { return safeTry(function* () { const nested = () => { for (const row of rows) { save(row); } }; return ok(nested); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "sequential loops do not permit domain branching",
			code: `import { ok, safeTry } from "neverthrow"; export function run(rows) { return safeTry(async function* () { for (const row of rows) { if (row.paid) yield* save(row); } return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "sequential loops do not permit raw awaits",
			code: `import { ok, safeTry } from "neverthrow"; export function run(rows) { return safeTry(async function* () { for (const row of rows) { await save(row); } return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "sequential loops do not permit raw Convex calls",
			code: `import { ok, safeTry } from "neverthrow"; export function run(ctx, rows) { return safeTry(async function* () { for (const row of rows) { yield* ctx.runMutation(ref, row); } return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "plain yields do not propagate Result errors",
			code: `import { safeTry } from "neverthrow"; export function run(ctx) { return safeTry(async function* () { yield load(ctx); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "unrelated generators are not service composition",
			code: `export function* run(ctx) { yield* load(ctx); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "unrelated safeTry helpers do not permit yields",
			code: `import { safeTry } from "./helpers"; export function run(ctx) { return safeTry(async function* () { yield* load(ctx); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "shadowed neverthrow imports do not permit yields",
			code: `import { safeTry } from "neverthrow"; export function run(ctx, safeTry) { return safeTry(async function* () { yield* load(ctx); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "safeTry does not permit nested unrelated generators",
			code: `import { ok, safeTry } from "neverthrow"; export function run(ctx) { return safeTry(async function* () { const nested = function* () { yield* load(ctx); }; return ok(nested); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "safeTry does not permit raw awaits",
			code: `import { ok, safeTry } from "neverthrow"; export function run(ctx) { return safeTry(async function* () { const row = await load(ctx); return ok(row); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "safeTry does not move domain branches into services",
			code: `import { ok, safeTry } from "neverthrow"; export function run(ctx) { return safeTry(async function* () { const row = yield* load(ctx); if (row) yield* save(ctx, row); return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "safeTry does not permit raw Convex calls",
			code: `import { ok, safeTry } from "neverthrow"; export function run(ctx) { return safeTry(async function* () { const row = yield* ctx.runQuery(ref, {}); return ok(row); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "returned thunks are not service composition",
			code: `function run(row) { const next = selectOperation(row, found, missing); return next(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			name: "immediately invoked operation selectors are rejected",
			code: `function run(row) { return selectOperation(row, found, missing)(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},

		{
			filename,
			code: `export function run() { const operations = { save: saveBooking }; const { save: next } = operations; return next(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(rows) { const { filter } = rows; return filter(isEligible); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(rows) { const { filter: choose } = rows; const alias = choose; return alias(isEligible); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(ctx) { return ctx["runQuery"](ref, {}); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export function run(ctx) { return ctx["scheduler"].runAfter(0, ref, {}); }`,
			errors: [{ messageId: "implementation" }]
		},

		{
			filename,
			code: `export function run(saved) { const next = saved ? sendReceipt : finish; return next.call(null); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(saved) { const next = saved ? sendReceipt : finish; return next.apply(null, []); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(action, operations) { return operations[action](); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(saved, first, second) { const sender = saved ? first : second; return sender.send(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(sender) { const send = sender?.sendReceipt; return send(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(action) { const operations = { save: saveBooking }; return operations.save(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},

		{
			filename,
			code: `export function run(action) { return action === "save" ? save() : send(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(saved) { return saved ? sendReceipt() : okAsync(null); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(saved) { return saved && sendReceipt(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(existing) { return existing || createBooking(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(existing) { return existing ?? createBooking(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(sender) { return sender?.sendReceipt(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(send) { return send?.(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(sender) { return sender?.client.sendReceipt(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(saved) { const next = saved ? sendReceipt : finish; return next(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(saved) { const next = saved ? sendReceipt : finish; const alias = next; return alias(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(saved) { const next = saved ? sendReceipt : finish; return load().andThen(next); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(saved) { return load().andThen(saved ? sendReceipt : finish); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(saved) { const next = saved && sendReceipt; return next(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(action) { const operations = { save: saveBooking, send: sendReceipt }; return operations[action](); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(action) { const operations = { saveBooking, sendReceipt }; const alias = operations; return alias[action](); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(action) { const operations = { save: saveBooking }; const next = operations[action]; return next(); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(action) { const operations = { save: saveBooking }; return load().andThen(operations[action]); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(rows) { return rows.filter(row => row.paid); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(rows) { return rows["filter"](isEligible); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(rows) { const filter = rows.filter; return filter(isEligible); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(row) { const next = sendReceipt.bind(null, row); return load().andThen(next); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `function hidden(saved) { return saved ? sendReceipt() : okAsync(null); } export function run(saved) { return load().andThen(() => hidden(saved)); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(row) { return load().andThen(value => value ? save(value) : okAsync(null)); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},

		{
			filename,
			code: `export function run(action) { return { complete: () => okAsync({}), save: () => save(), send: () => send() }[action](); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(kind) { const outcomes = { ready: () => save(), none: () => okAsync(null) }; return outcomes[kind](); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(kind) { const outcomes = { ready: () => save() }; return load().andThen(() => outcomes[kind]()); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			code: `export function run(ctx) { return ctx.auth.getUserIdentity(); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export function run(ctx) { return ctx.scheduler.runAfter(0, ref, {}); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export function load(ctx, args) { return fromConvexTuple(ctx.runQuery(queryRef, args)); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export function save(ctx, args) { return ctx.runMutation(mutationRef, args); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export function run(ctx, args) { return ctx.runAction(actionRef, args); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `function validate(row) { if (row) return ok(row); return err("MISSING"); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export function run(ctx) { return load(ctx).andThen(row => { if (row) return save(ctx, row); return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export function run(rows) { for (const row of rows) { save(row); } return done(); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export async function run(ctx) { return await load(ctx); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export function run() { throw error; }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			code: `export function run(row) { row.status = "paid"; return ok(row); }`,
			errors: [{ messageId: "implementation" }]
		}
	]
});
