// Services allow value mappings, chain/generator composition, and eligible-item iteration. Tests reject
// conditional calls, selected callbacks, table aliases, optional calls, filters, binds, and hidden branches.
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
			code: `import { safeTry, ok } from "neverthrow"; export function run(ctx, id) { return safeTry(function* () { const row = yield* load(ctx, id); const validated = yield* validate(row); return ok({ id: validated.id, label: row.name ?? "Guest" }); }); }`
		},
		{
			filename,
			code: `import { safeTry, ok, ResultAsync } from "neverthrow"; export function run(ctx, id) { return safeTry(async function* () { const row = yield* load(ctx, id).orElse(recover); const [first, second] = yield* ResultAsync.combine([loadFirst(ctx, row), loadSecond(ctx, row)]); yield* save(ctx, { first, second, status: row.paid ? "paid" : "unpaid" }); return ok(null); }); }`
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
			name: "plain yield does not propagate Result errors",
			code: `export function run(ctx) { return safeTry(function* () { yield load(ctx); return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "generators cannot branch on domain values",
			code: `export function run(ctx) { return safeTry(async function* () { const row = yield* load(ctx); if (row.paid) return yield* save(ctx, row); return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "generators cannot select conditional operations",
			code: `export function run(ctx) { return safeTry(async function* () { const row = yield* load(ctx); return yield* (row.paid ? save(ctx, row) : okAsync(null)); }); }`,
			errors: [{ messageId: "callbackDispatch" }]
		},
		{
			filename,
			name: "generators cannot loop over domain records",
			code: `export function run(rows) { return safeTry(async function* () { for (const row of rows) { yield* save(row); } return ok(null); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "generators compose ResultAsync without await",
			code: `export function run(ctx) { return safeTry(async function* () { const row = yield* (await load(ctx)); return ok(row); }); }`,
			errors: [{ messageId: "implementation" }]
		},
		{
			filename,
			name: "generators cannot perform raw scheduler I/O",
			code: `export function run(ctx) { return safeTry(async function* () { yield* okOrThrow(ctx.scheduler.runAfter(0, ref, {})); return ok(null); }); }`,
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
