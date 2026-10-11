// These tests describe where Convex Result.match is allowed and which forms count as a handler boundary.
import { describe, it } from "node:test";

import { RuleTester } from "oxlint/plugins-dev";

import { noResultMatchOutsideHandlerRule } from "./no-result-match-outside-handler.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
RuleTester.describe = describe;
RuleTester.it = it;

tester.run("convex-layers/no-result-match-outside-handler", noResultMatchOutsideHandlerRule, {
	valid: [
		{
			filename: "convex/booking/checkout.ts",
			name: "awaited terminal tuple conversion in concise handler",
			code: `import { action } from "#convex/_generated/server"; export const run = action({handler: async ctx => await service(ctx).match(tupleOk, tupleErr)});`
		},
		{
			filename: "convex/booking/checkout.ts",
			name: "awaited terminal tuple conversion in block handler",
			code: `import { action } from "#convex/_generated/server"; export const run = action({handler: async ctx => { return await service(ctx).match(tupleOk, tupleErr); }});`
		},

		{
			filename: "convex/sessions/admin.ts",
			name: "handler returns a terminal tuple conversion",
			code: `import { query } from "#convex/_generated/server"; export const getSession = query({ handler: (ctx, args) => loadSession(ctx, args).match(tupleOk, tupleErr) });`
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "handler block returns a terminal tuple conversion",
			code: `import { query } from "#convex/_generated/server"; export const getSession = query({ handler: (ctx, args) => { return loadSession(ctx, args).match(tupleOk, tupleErr); } });`
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "aliased Convex handler builders remain recognized",
			code: `import { query as defineQuery } from "#convex/_generated/server"; export const getSession = defineQuery({ handler: (ctx) => loadSession(ctx).match(tupleOk, tupleErr) });`
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "namespace Convex handler builders remain recognized",
			code: `import * as server from "#convex/_generated/server"; export const getSession = server.query({ handler: (ctx) => loadSession(ctx).match(tupleOk, tupleErr) });`
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "pagination handler needs no match call",
			code: `import { query } from "#convex/_generated/server"; export const listSessions = query({ handler: (ctx) => ctx.db.query("sessions").paginate({ numItems: 20, cursor: null }) });`
		},
		{
			filename: "src/features/sessions.ts",
			name: "files outside Convex are not checked",
			code: `return result.match(onOk, onErr);`
		},
		{
			filename: "convex/_generated/api.ts",
			name: "generated Convex files are not checked",
			code: `return result.match(onOk, onErr);`
		},
		{
			filename: "convex/sessions/tests/fixtures.ts",
			name: "Convex test fixtures are not checked",
			code: `return result.match(onOk, onErr);`
		},
		{
			filename: "convex/sessions/lib/parse.ts",
			name: "string parsing with a regular expression remains allowed",
			code: `export function parse(value) { return value.match(/^session-(.+)$/u); }`
		},
		{
			filename: "convex/sessions/lib/parse.ts",
			name: "string parsing with a RegExp constructor remains allowed",
			code: `export function parse(value) { return value.match(new RegExp("^session-(.+)$", "u")); }`
		},
		{
			filename: "convex/http.ts",
			name: "registered direct handler callbacks allow terminal tuple conversion",
			code: `import { httpAction } from "#convex/_generated/server"; export const endpoint = httpAction((ctx) => run(ctx).match(tupleOk, tupleErr));`
		}
	],
	invalid: [
		{
			filename: "convex/sessions/services/list.ts",
			name: "service cannot consume a Result",
			code: `export function list(ctx) { return listSessions(ctx).match(tupleOk, tupleErr); }`,
			errors: [{ messageId: "resultMatch" }]
		},
		{
			filename: "convex/sessions/services/list.ts",
			name: "a handler-shaped callback in a service is not a handler boundary",
			code: `import { query } from "elsewhere"; export const list = query({ handler: (ctx) => listSessions(ctx).match(tupleOk, tupleErr) });`,
			errors: [{ messageId: "resultMatch" }]
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "a method named query without the generated server import is not a handler boundary",
			code: `const builder = { query: (options) => options }; export const list = builder.query({ handler: (ctx) => listSessions(ctx).match(tupleOk, tupleErr) });`,
			errors: [{ messageId: "resultMatch" }]
		},
		{
			filename: "convex/sessions/lib/list.ts",
			name: "lib cannot consume a Result",
			code: `export function list(result) { return result.match(tupleOk, tupleErr); }`,
			errors: [{ messageId: "resultMatch" }]
		},
		{
			filename: "convex/sessions/services/list.ts",
			name: "computed method access is rejected",
			code: `export function getMatch(result) { return result["match"]; }`,
			errors: [{ messageId: "resultMatch" }]
		},
		{
			filename: "convex/sessions/lib/list.ts",
			name: "method references are rejected",
			code: `export function getMatch(result) { const method = result.match; return method; }`,
			errors: [{ messageId: "resultMatch" }]
		},
		{
			filename: "convex/sessions/lib/list.ts",
			name: "destructuring a match method is rejected",
			code: `export function getMatch(result) { const { match } = result; return match; }`,
			errors: [{ messageId: "resultMatch" }]
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "handler cannot use match for a local computation",
			code: `import { query } from "#convex/_generated/server"; export const getSession = query({ handler: (ctx) => { const value = getSessionResult(ctx).match(tupleOk, tupleErr); return value; } });`,
			errors: [{ messageId: "handlerResultMatch" }]
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "handler cannot pass match result through another operation",
			code: `import { query } from "#convex/_generated/server"; export const getSession = query({ handler: (ctx) => getSessionResult(ctx).match(tupleOk, tupleErr).map((value) => value) });`,
			errors: [{ messageId: "handlerResultMatch" }]
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "handler cannot use match within another callback",
			code: `import { query } from "#convex/_generated/server"; export const getSession = query({ handler: (ctx) => values.map((value) => result.match(tupleOk, tupleErr)) });`,
			errors: [{ messageId: "handlerResultMatch" }]
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "handler match must use the tuple converters",
			code: `import { query } from "#convex/_generated/server"; export const getSession = query({ handler: (ctx) => getSessionResult(ctx).match(onOk, onErr) });`,
			errors: [{ messageId: "handlerResultMatch" }]
		},
		{
			filename: "convex/sessions/admin.ts",
			name: "a helper in a handler module remains outside the handler boundary",
			code: `import { query } from "#convex/_generated/server"; function helper(result) { return result.match(tupleOk, tupleErr); } export const getSession = query({ handler: (ctx) => helper(run(ctx)) });`,
			errors: [{ messageId: "resultMatch" }]
		}
	]
});
